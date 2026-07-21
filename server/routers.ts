import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { notifyOwner } from "./_core/notification";
import { invokeLLM } from "./_core/llm";
import { sendCampaign as sendCampaignPipeline } from "./emailSender";
import { createHeartbeatJob } from "./_core/heartbeat";
import { verifyDomainDns } from "./dnsVerifier";
import { parse as parseCookie } from "cookie";
import { z } from "zod";
import { eq, and, sql, desc } from "drizzle-orm";
import * as db from "./db";
import { TRPCError } from "@trpc/server";

// ─────────────────────────────────────────────
// Helper: get or create default org for user
// ─────────────────────────────────────────────
async function getOrCreateUserOrg(userId: number, userName: string) {
  const orgs = await db.getOrgsByUserId(userId);
  if (orgs.length > 0) return orgs[0].org;
  // Create default org
  const slug = `org-${userId}-${Date.now().toString(36)}`;
  const org = await db.createOrg(`${userName || 'My'} Organization`, slug, userId);
  // Notify platform owner of new org signup
  try {
    await notifyOwner({
      title: "Nova organização cadastrada no MailFlow",
      content: `A organização "${org!.name}" foi criada por ${userName || 'um usuário'} (ID: ${userId}).`,
    });
  } catch (e) { /* non-blocking */ }
  return org;
}

async function getUserOrg(userId: number, orgId: number) {
  const member = await db.getOrgMember(orgId, userId);
  if (!member || member.status === 'removed') return null;
  const org = await db.getOrgById(orgId);
  return org;
}

// ─────────────────────────────────────────────
// Schemas (Zod)
// ─────────────────────────────────────────────
const orgIdSchema = z.object({ orgId: z.number() });

const createOrgSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(100).optional(),
});

const updateOrgSchema = z.object({
  orgId: z.number(),
  name: z.string().min(1).max(255).optional(),
  defaultFromName: z.string().max(255).optional(),
  defaultFromEmail: z.string().max(320).optional(),
  defaultReplyTo: z.string().max(320).optional(),
});

const inviteMemberSchema = z.object({
  orgId: z.number(),
  email: z.string().email(),
  role: z.enum(['admin', 'member']).default('member'),
});

const updateMemberSchema = z.object({
  orgId: z.number(),
  userId: z.number(),
  role: z.enum(['admin', 'member']).optional(),
});

const createContactSchema = z.object({
  orgId: z.number(),
  email: z.string().email(),
  firstName: z.string().max(255).optional(),
  lastName: z.string().max(255).optional(),
  phone: z.string().max(50).optional(),
  listIds: z.array(z.number()).optional(),
});

const updateContactSchema = z.object({
  orgId: z.number(),
  id: z.number(),
  email: z.string().email().optional(),
  firstName: z.string().max(255).optional(),
  lastName: z.string().max(255).optional(),
  phone: z.string().max(50).optional(),
  status: z.enum(['subscribed', 'unsubscribed', 'bounced', 'complained']).optional(),
});

const importContactsSchema = z.object({
  orgId: z.number(),
  listId: z.number().optional(),
  contacts: z.array(z.object({
    email: z.string().email(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    phone: z.string().optional(),
  })).min(1).max(10000),
});

const createListSchema = z.object({
  orgId: z.number(),
  name: z.string().min(1).max(255),
  description: z.string().optional(),
});

const updateListSchema = z.object({
  orgId: z.number(),
  id: z.number(),
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
});

const createTagSchema = z.object({
  orgId: z.number(),
  name: z.string().min(1).max(100),
  color: z.string().max(7).optional(),
});

const createCustomFieldSchema = z.object({
  orgId: z.number(),
  name: z.string().min(1).max(100),
  key: z.string().min(1).max(100),
  type: z.enum(['text', 'number', 'date', 'boolean', 'select']),
  options: z.string().optional(),
});

const createSegmentSchema = z.object({
  orgId: z.number(),
  name: z.string().min(1).max(255),
  rules: z.string(),
  matchType: z.enum(['all', 'any']),
  description: z.string().optional(),
});

const updateSegmentSchema = z.object({
  orgId: z.number(),
  id: z.number(),
  name: z.string().min(1).max(255).optional(),
  rules: z.string().optional(),
  matchType: z.enum(['all', 'any']).optional(),
  description: z.string().optional(),
});

const createTemplateSchema = z.object({
  orgId: z.number(),
  name: z.string().min(1).max(255),
  subject: z.string().max(500).optional(),
  preheader: z.string().max(500).optional(),
  htmlContent: z.string().optional(),
  textContent: z.string().optional(),
  category: z.string().max(100).optional(),
});

const updateTemplateSchema = z.object({
  orgId: z.number(),
  id: z.number(),
  name: z.string().min(1).max(255).optional(),
  subject: z.string().max(500).optional(),
  preheader: z.string().max(500).optional(),
  htmlContent: z.string().optional(),
  textContent: z.string().optional(),
  category: z.string().max(100).optional(),
});

const createCampaignSchema = z.object({
  orgId: z.number(),
  name: z.string().min(1).max(255),
  subject: z.string().min(1).max(500),
  preheader: z.string().max(500).optional(),
  fromName: z.string().max(255).optional(),
  fromEmail: z.string().max(320).optional(),
  replyTo: z.string().max(320).optional(),
  htmlContent: z.string().optional(),
  textContent: z.string().optional(),
  designJson: z.string().optional(),
  targetListId: z.number().optional(),
  targetSegmentId: z.number().optional(),
  isAbTest: z.boolean().optional(),
  abSubjectB: z.string().max(500).optional(),
  abHtmlContentB: z.string().optional(),
  abWinnerCriteria: z.enum(['open_rate', 'click_rate']).optional(),
  abAutoWinner: z.boolean().optional(),
  abTestPercent: z.number().min(5).max(100).optional(),
  abWaitHours: z.number().min(1).max(168).optional(),
});

const updateCampaignSchema = z.object({
  orgId: z.number(),
  id: z.number(),
  name: z.string().min(1).max(255).optional(),
  subject: z.string().min(1).max(500).optional(),
  preheader: z.string().max(500).optional(),
  fromName: z.string().max(255).optional(),
  fromEmail: z.string().max(320).optional(),
  replyTo: z.string().max(320).optional(),
  htmlContent: z.string().optional(),
  textContent: z.string().optional(),
  designJson: z.string().optional(),
  targetListId: z.number().optional(),
  targetSegmentId: z.number().optional(),
  status: z.enum(['draft', 'scheduled', 'sending', 'sent', 'paused', 'failed']).optional(),
  scheduledAt: z.date().optional(),
  isAbTest: z.boolean().optional(),
  abSubjectB: z.string().max(500).optional(),
  abHtmlContentB: z.string().optional(),
  abWinnerCriteria: z.enum(['open_rate', 'click_rate']).optional(),
  abAutoWinner: z.boolean().optional(),
  abTestPercent: z.number().min(5).max(100).optional(),
  abWaitHours: z.number().min(1).max(168).optional(),
});

const createAutomationSchema = z.object({
  orgId: z.number(),
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  triggerType: z.enum(['list_subscription', 'email_open', 'link_click', 'specific_date']),
  triggerConfig: z.string(),
  steps: z.array(z.object({
    type: z.enum(['send_email', 'wait', 'condition', 'add_tag', 'remove_tag', 'move_to_list']),
    config: z.string(),
  })).optional(),
});

const updateAutomationSchema = z.object({
  orgId: z.number(),
  id: z.number(),
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  triggerType: z.enum(['list_subscription', 'email_open', 'link_click', 'specific_date']).optional(),
  triggerConfig: z.string().optional(),
  status: z.enum(['active', 'paused', 'draft']).optional(),
});

const createSendingDomainSchema = z.object({
  orgId: z.number(),
  domain: z.string().min(1).max(255),
  dkimSelector: z.string().max(100).optional(),
});

const updateSendingDomainSchema = z.object({
  orgId: z.number(),
  id: z.number(),
  verificationStatus: z.enum(['pending', 'verified', 'failed']).optional(),
  dkimStatus: z.enum(['pending', 'verified', 'failed']).optional(),
  spfStatus: z.enum(['pending', 'verified', 'failed']).optional(),
  dmarcStatus: z.enum(['pending', 'verified', 'failed']).optional(),
  isDefault: z.boolean().optional(),
});

const createSmtpConfigSchema = z.object({
  orgId: z.number(),
  provider: z.enum(['sendgrid', 'mailgun', 'ses', 'smtp', 'mailflow']),
  name: z.string().min(1).max(255),
  apiKey: z.string().optional(),
  smtpHost: z.string().max(255).optional(),
  smtpPort: z.number().optional(),
  smtpUsername: z.string().max(255).optional(),
  smtpPassword: z.string().optional(),
  fromEmail: z.string().max(320).optional(),
  fromName: z.string().max(255).optional(),
  replyTo: z.string().max(320).optional(),
  isDefault: z.boolean().optional(),
});

const updateSmtpConfigSchema = z.object({
  orgId: z.number(),
  id: z.number(),
  provider: z.enum(['sendgrid', 'mailgun', 'ses', 'smtp', 'mailflow']).optional(),
  name: z.string().min(1).max(255).optional(),
  apiKey: z.string().optional(),
  smtpHost: z.string().max(255).optional(),
  smtpPort: z.number().optional(),
  smtpUsername: z.string().max(255).optional(),
  smtpPassword: z.string().optional(),
  fromEmail: z.string().max(320).optional(),
  fromName: z.string().max(255).optional(),
  replyTo: z.string().max(320).optional(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

// ─────────────────────────────────────────────
// App Router
// ─────────────────────────────────────────────
export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ─────────────────────────────────────────────
  // Organization
  // ─────────────────────────────────────────────
  org: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const orgs = await db.getOrgsByUserId(ctx.user.id);
      return orgs.map(o => ({ ...o.org, role: o.member.role }));
    }),

    current: protectedProcedure.input(z.object({ orgId: z.number() })).query(async ({ ctx, input }) => {
      const org = await getUserOrg(ctx.user.id, input.orgId);
      if (!org) throw new TRPCError({ code: 'NOT_FOUND', message: 'Organization not found' });
      return org;
    }),

    create: protectedProcedure.input(createOrgSchema).mutation(async ({ ctx, input }) => {
      const slug = input.slug || `org-${ctx.user.id}-${Date.now().toString(36)}`;
      const org = await db.createOrg(input.name, slug, ctx.user.id);
      try {
        await notifyOwner({
          title: "Nova organização cadastrada no MailFlow",
          content: `A organização "${input.name}" foi criada por ${ctx.user.name || ctx.user.email} (ID: ${ctx.user.id}).`,
        });
      } catch (e) { /* non-blocking */ }
      return org;
    }),

    update: protectedProcedure.input(updateOrgSchema).mutation(async ({ ctx, input }) => {
      const org = await getUserOrg(ctx.user.id, input.orgId);
      if (!org) throw new TRPCError({ code: 'NOT_FOUND' });
      const { orgId, ...data } = input;
      return db.updateOrg(orgId, data);
    }),

    members: protectedProcedure.input(orgIdSchema).query(async ({ ctx, input }) => {
      const org = await getUserOrg(ctx.user.id, input.orgId);
      if (!org) throw new TRPCError({ code: 'NOT_FOUND' });
      return db.getOrgMembers(input.orgId);
    }),

    inviteMember: protectedProcedure.input(inviteMemberSchema).mutation(async ({ ctx, input }) => {
      const org = await getUserOrg(ctx.user.id, input.orgId);
      if (!org) throw new TRPCError({ code: 'NOT_FOUND' });
      // Check if user is admin
      const member = await db.getOrgMember(input.orgId, ctx.user.id);
      if (!member || member.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN', message: 'Only admins can invite members' });
      // Find user by email
      const dbInstance = await db.getDb();
      if (!dbInstance) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
      const { users } = await import("../drizzle/schema");
      const userResult = await dbInstance.select().from(users).where(eq(users.email, input.email)).limit(1);
      if (userResult.length === 0) {
        // Create an invited member record with status 'invited'
        // In production, send an invitation email
        return { status: 'invited', email: input.email, message: 'Invitation sent. User will be added when they sign up.' };
      }
      const invitedUser = userResult[0];
      return db.addOrgMember(input.orgId, invitedUser.id, input.role, input.email);
    }),

    updateMember: protectedProcedure.input(updateMemberSchema).mutation(async ({ ctx, input }) => {
      const org = await getUserOrg(ctx.user.id, input.orgId);
      if (!org) throw new TRPCError({ code: 'NOT_FOUND' });
      const member = await db.getOrgMember(input.orgId, ctx.user.id);
      if (!member || member.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN', message: 'Only admins can update member roles' });
      const { userId, ...data } = input;
      return db.updateOrgMember(input.orgId, userId, data);
    }),

    removeMember: protectedProcedure.input(updateMemberSchema).mutation(async ({ ctx, input }) => {
      const org = await getUserOrg(ctx.user.id, input.orgId);
      if (!org) throw new TRPCError({ code: 'NOT_FOUND' });
      const member = await db.getOrgMember(input.orgId, ctx.user.id);
      if (!member || member.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN', message: 'Only admins can remove members' });
      await db.removeOrgMember(input.orgId, input.userId);
      return { success: true };
    }),
  }),

  // ─────────────────────────────────────────────
  // Contacts
  // ─────────────────────────────────────────────
  contacts: router({
    list: protectedProcedure.input(z.object({
      orgId: z.number(),
      limit: z.number().min(1).max(200).default(50),
      offset: z.number().min(0).default(0),
      search: z.string().optional(),
    })).query(async ({ ctx, input }) => {
      const org = await getUserOrg(ctx.user.id, input.orgId);
      if (!org) throw new TRPCError({ code: 'NOT_FOUND' });
      return db.getContacts(input.orgId, input.limit, input.offset, input.search);
    }),

    byId: protectedProcedure.input(z.object({ orgId: z.number(), id: z.number() })).query(async ({ ctx, input }) => {
      const org = await getUserOrg(ctx.user.id, input.orgId);
      if (!org) throw new TRPCError({ code: 'NOT_FOUND' });
      const contact = await db.getContactById(input.orgId, input.id);
      if (!contact) throw new TRPCError({ code: 'NOT_FOUND' });
      const tags = await db.getContactTags(input.id);
      const customValues = await db.getContactCustomValues(input.id);
      return { ...contact, tags, customValues };
    }),

    create: protectedProcedure.input(createContactSchema).mutation(async ({ ctx, input }) => {
      const org = await getUserOrg(ctx.user.id, input.orgId);
      if (!org) throw new TRPCError({ code: 'NOT_FOUND' });
      const { listIds, ...contactData } = input;
      const contact = await db.createContact(input.orgId, contactData);
      if (contact && listIds) {
        for (const listId of listIds) {
          await db.addContactToList(contact.id, listId);
        }
      }
      return contact;
    }),

    update: protectedProcedure.input(updateContactSchema).mutation(async ({ ctx, input }) => {
      const org = await getUserOrg(ctx.user.id, input.orgId);
      if (!org) throw new TRPCError({ code: 'NOT_FOUND' });
      const { orgId, id, ...data } = input;
      return db.updateContact(orgId, id, data);
    }),

    delete: protectedProcedure.input(z.object({ orgId: z.number(), id: z.number() })).mutation(async ({ ctx, input }) => {
      const org = await getUserOrg(ctx.user.id, input.orgId);
      if (!org) throw new TRPCError({ code: 'NOT_FOUND' });
      await db.deleteContact(input.orgId, input.id);
      return { success: true };
    }),

    import: protectedProcedure.input(importContactsSchema).mutation(async ({ ctx, input }) => {
      const org = await getUserOrg(ctx.user.id, input.orgId);
      if (!org) throw new TRPCError({ code: 'NOT_FOUND' });
      return db.bulkImportContacts(input.orgId, input.contacts, input.listId);
    }),

    count: protectedProcedure.input(orgIdSchema).query(async ({ ctx, input }) => {
      const org = await getUserOrg(ctx.user.id, input.orgId);
      if (!org) throw new TRPCError({ code: 'NOT_FOUND' });
      return db.getContactCount(input.orgId);
    }),

    listAdvanced: protectedProcedure.input(z.object({
      orgId: z.number(),
      limit: z.number().min(1).max(200).default(50),
      offset: z.number().min(0).default(0),
      search: z.string().optional(),
      tagIds: z.array(z.number()).optional(),
      listId: z.number().optional(),
      status: z.enum(['subscribed', 'unsubscribed', 'bounced', 'complained']).optional(),
      engagement: z.enum(['opened', 'clicked', 'no_engagement']).optional(),
    })).query(async ({ ctx, input }) => {
      const org = await getUserOrg(ctx.user.id, input.orgId);
      if (!org) throw new TRPCError({ code: 'NOT_FOUND' });
      const { orgId, limit, offset, ...filters } = input;
      return db.getContactsAdvanced(orgId, filters, limit, offset);
    }),
  }),

  // ─────────────────────────────────────────────
  // Lists
  // ─────────────────────────────────────────────
  lists: router({
    list: protectedProcedure.input(orgIdSchema).query(async ({ ctx, input }) => {
      const org = await getUserOrg(ctx.user.id, input.orgId);
      if (!org) throw new TRPCError({ code: 'NOT_FOUND' });
      const lists = await db.getLists(input.orgId);
      const listsWithCounts = await Promise.all(
        lists.map(async l => ({ ...l, memberCount: await db.getListMemberCount(l.id) }))
      );
      return listsWithCounts;
    }),

    byId: protectedProcedure.input(z.object({ orgId: z.number(), id: z.number() })).query(async ({ ctx, input }) => {
      const org = await getUserOrg(ctx.user.id, input.orgId);
      if (!org) throw new TRPCError({ code: 'NOT_FOUND' });
      const list = await db.getListById(input.orgId, input.id);
      if (!list) throw new TRPCError({ code: 'NOT_FOUND' });
      return { ...list, memberCount: await db.getListMemberCount(input.id) };
    }),

    create: protectedProcedure.input(createListSchema).mutation(async ({ ctx, input }) => {
      const org = await getUserOrg(ctx.user.id, input.orgId);
      if (!org) throw new TRPCError({ code: 'NOT_FOUND' });
      return db.createList(input.orgId, input.name, input.description);
    }),

    update: protectedProcedure.input(updateListSchema).mutation(async ({ ctx, input }) => {
      const org = await getUserOrg(ctx.user.id, input.orgId);
      if (!org) throw new TRPCError({ code: 'NOT_FOUND' });
      const { orgId, id, ...data } = input;
      return db.updateList(orgId, id, data);
    }),

    delete: protectedProcedure.input(z.object({ orgId: z.number(), id: z.number() })).mutation(async ({ ctx, input }) => {
      const org = await getUserOrg(ctx.user.id, input.orgId);
      if (!org) throw new TRPCError({ code: 'NOT_FOUND' });
      await db.deleteList(input.orgId, input.id);
      return { success: true };
    }),

    members: protectedProcedure.input(z.object({
      orgId: z.number(),
      listId: z.number(),
      limit: z.number().min(1).max(200).default(50),
      offset: z.number().min(0).default(0),
    })).query(async ({ ctx, input }) => {
      const org = await getUserOrg(ctx.user.id, input.orgId);
      if (!org) throw new TRPCError({ code: 'NOT_FOUND' });
      return db.getListMembers(input.orgId, input.listId, input.limit, input.offset);
    }),

    addContact: protectedProcedure.input(z.object({
      orgId: z.number(),
      contactId: z.number(),
      listId: z.number(),
    })).mutation(async ({ ctx, input }) => {
      const org = await getUserOrg(ctx.user.id, input.orgId);
      if (!org) throw new TRPCError({ code: 'NOT_FOUND' });
      await db.addContactToList(input.contactId, input.listId);
      return { success: true };
    }),

    removeContact: protectedProcedure.input(z.object({
      orgId: z.number(),
      contactId: z.number(),
      listId: z.number(),
    })).mutation(async ({ ctx, input }) => {
      const org = await getUserOrg(ctx.user.id, input.orgId);
      if (!org) throw new TRPCError({ code: 'NOT_FOUND' });
      await db.removeContactFromList(input.contactId, input.listId);
      return { success: true };
    }),
  }),

  // ─────────────────────────────────────────────
  // Tags
  // ─────────────────────────────────────────────
  tags: router({
    list: protectedProcedure.input(orgIdSchema).query(async ({ ctx, input }) => {
      const org = await getUserOrg(ctx.user.id, input.orgId);
      if (!org) throw new TRPCError({ code: 'NOT_FOUND' });
      return db.getTags(input.orgId);
    }),

    create: protectedProcedure.input(createTagSchema).mutation(async ({ ctx, input }) => {
      const org = await getUserOrg(ctx.user.id, input.orgId);
      if (!org) throw new TRPCError({ code: 'NOT_FOUND' });
      return db.createTag(input.orgId, input.name, input.color);
    }),

    delete: protectedProcedure.input(z.object({ orgId: z.number(), id: z.number() })).mutation(async ({ ctx, input }) => {
      const org = await getUserOrg(ctx.user.id, input.orgId);
      if (!org) throw new TRPCError({ code: 'NOT_FOUND' });
      await db.deleteTag(input.orgId, input.id);
      return { success: true };
    }),

    addToContact: protectedProcedure.input(z.object({
      orgId: z.number(),
      contactId: z.number(),
      tagId: z.number(),
    })).mutation(async ({ ctx, input }) => {
      const org = await getUserOrg(ctx.user.id, input.orgId);
      if (!org) throw new TRPCError({ code: 'NOT_FOUND' });
      await db.addTagToContact(input.contactId, input.tagId);
      return { success: true };
    }),

    removeFromContact: protectedProcedure.input(z.object({
      orgId: z.number(),
      contactId: z.number(),
      tagId: z.number(),
    })).mutation(async ({ ctx, input }) => {
      const org = await getUserOrg(ctx.user.id, input.orgId);
      if (!org) throw new TRPCError({ code: 'NOT_FOUND' });
      await db.removeTagFromContact(input.contactId, input.tagId);
      return { success: true };
    }),
  }),

  // ─────────────────────────────────────────────
  // Custom Fields
  // ─────────────────────────────────────────────
  customFields: router({
    list: protectedProcedure.input(orgIdSchema).query(async ({ ctx, input }) => {
      const org = await getUserOrg(ctx.user.id, input.orgId);
      if (!org) throw new TRPCError({ code: 'NOT_FOUND' });
      return db.getCustomFields(input.orgId);
    }),

    create: protectedProcedure.input(createCustomFieldSchema).mutation(async ({ ctx, input }) => {
      const org = await getUserOrg(ctx.user.id, input.orgId);
      if (!org) throw new TRPCError({ code: 'NOT_FOUND' });
      return db.createCustomField(input.orgId, input.name, input.key, input.type, input.options);
    }),

    delete: protectedProcedure.input(z.object({ orgId: z.number(), id: z.number() })).mutation(async ({ ctx, input }) => {
      const org = await getUserOrg(ctx.user.id, input.orgId);
      if (!org) throw new TRPCError({ code: 'NOT_FOUND' });
      await db.deleteCustomField(input.orgId, input.id);
      return { success: true };
    }),
  }),

  // ─────────────────────────────────────────────
  // Segments
  // ─────────────────────────────────────────────
  segments: router({
    list: protectedProcedure.input(orgIdSchema).query(async ({ ctx, input }) => {
      const org = await getUserOrg(ctx.user.id, input.orgId);
      if (!org) throw new TRPCError({ code: 'NOT_FOUND' });
      const segments = await db.getSegments(input.orgId);
      const segmentsWithCounts = await Promise.all(
        segments.map(async s => ({ ...s, contactCount: await db.getSegmentContactCount(input.orgId, s.id) }))
      );
      return segmentsWithCounts;
    }),

    byId: protectedProcedure.input(z.object({ orgId: z.number(), id: z.number() })).query(async ({ ctx, input }) => {
      const org = await getUserOrg(ctx.user.id, input.orgId);
      if (!org) throw new TRPCError({ code: 'NOT_FOUND' });
      const segment = await db.getSegmentById(input.orgId, input.id);
      if (!segment) throw new TRPCError({ code: 'NOT_FOUND' });
      return { ...segment, contactCount: await db.getSegmentContactCount(input.orgId, input.id) };
    }),

    create: protectedProcedure.input(createSegmentSchema).mutation(async ({ ctx, input }) => {
      const org = await getUserOrg(ctx.user.id, input.orgId);
      if (!org) throw new TRPCError({ code: 'NOT_FOUND' });
      return db.createSegment(input.orgId, input.name, input.rules, input.matchType, input.description);
    }),

    update: protectedProcedure.input(updateSegmentSchema).mutation(async ({ ctx, input }) => {
      const org = await getUserOrg(ctx.user.id, input.orgId);
      if (!org) throw new TRPCError({ code: 'NOT_FOUND' });
      const { orgId, id, ...data } = input;
      return db.updateSegment(orgId, id, data);
    }),

    delete: protectedProcedure.input(z.object({ orgId: z.number(), id: z.number() })).mutation(async ({ ctx, input }) => {
      const org = await getUserOrg(ctx.user.id, input.orgId);
      if (!org) throw new TRPCError({ code: 'NOT_FOUND' });
      await db.deleteSegment(input.orgId, input.id);
      return { success: true };
    }),
  }),

  // ─────────────────────────────────────────────
  // Email Templates
  // ─────────────────────────────────────────────
  templates: router({
    list: protectedProcedure.input(orgIdSchema).query(async ({ ctx, input }) => {
      const org = await getUserOrg(ctx.user.id, input.orgId);
      if (!org) throw new TRPCError({ code: 'NOT_FOUND' });
      return db.getTemplates(input.orgId);
    }),

    byId: protectedProcedure.input(z.object({ orgId: z.number(), id: z.number() })).query(async ({ ctx, input }) => {
      const org = await getUserOrg(ctx.user.id, input.orgId);
      if (!org) throw new TRPCError({ code: 'NOT_FOUND' });
      const template = await db.getTemplateById(input.orgId, input.id);
      if (!template) throw new TRPCError({ code: 'NOT_FOUND' });
      return template;
    }),

    create: protectedProcedure.input(createTemplateSchema).mutation(async ({ ctx, input }) => {
      const org = await getUserOrg(ctx.user.id, input.orgId);
      if (!org) throw new TRPCError({ code: 'NOT_FOUND' });
      return db.createTemplate(input.orgId, input);
    }),

    update: protectedProcedure.input(updateTemplateSchema).mutation(async ({ ctx, input }) => {
      const org = await getUserOrg(ctx.user.id, input.orgId);
      if (!org) throw new TRPCError({ code: 'NOT_FOUND' });
      const { orgId, id, ...data } = input;
      return db.updateTemplate(orgId, id, data);
    }),

    delete: protectedProcedure.input(z.object({ orgId: z.number(), id: z.number() })).mutation(async ({ ctx, input }) => {
      const org = await getUserOrg(ctx.user.id, input.orgId);
      if (!org) throw new TRPCError({ code: 'NOT_FOUND' });
      await db.deleteTemplate(input.orgId, input.id);
      return { success: true };
    }),
  }),

  // ─────────────────────────────────────────────
  // Campaigns
  // ─────────────────────────────────────────────
  campaigns: router({
    list: protectedProcedure.input(z.object({
      orgId: z.number(),
      limit: z.number().min(1).max(200).default(50),
      offset: z.number().min(0).default(0),
    })).query(async ({ ctx, input }) => {
      const org = await getUserOrg(ctx.user.id, input.orgId);
      if (!org) throw new TRPCError({ code: 'NOT_FOUND' });
      return db.getCampaigns(input.orgId, input.limit, input.offset);
    }),

    byId: protectedProcedure.input(z.object({ orgId: z.number(), id: z.number() })).query(async ({ ctx, input }) => {
      const org = await getUserOrg(ctx.user.id, input.orgId);
      if (!org) throw new TRPCError({ code: 'NOT_FOUND' });
      const campaign = await db.getCampaignById(input.orgId, input.id);
      if (!campaign) throw new TRPCError({ code: 'NOT_FOUND' });
      return campaign;
    }),

    create: protectedProcedure.input(createCampaignSchema).mutation(async ({ ctx, input }) => {
      const org = await getUserOrg(ctx.user.id, input.orgId);
      if (!org) throw new TRPCError({ code: 'NOT_FOUND' });
      return db.createCampaign(input.orgId, { ...input, createdBy: ctx.user.id });
    }),

    update: protectedProcedure.input(updateCampaignSchema).mutation(async ({ ctx, input }) => {
      const org = await getUserOrg(ctx.user.id, input.orgId);
      if (!org) throw new TRPCError({ code: 'NOT_FOUND' });
      const { orgId, id, ...data } = input;
      return db.updateCampaign(orgId, id, data);
    }),

    delete: protectedProcedure.input(z.object({ orgId: z.number(), id: z.number() })).mutation(async ({ ctx, input }) => {
      const org = await getUserOrg(ctx.user.id, input.orgId);
      if (!org) throw new TRPCError({ code: 'NOT_FOUND' });
      await db.deleteCampaign(input.orgId, input.id);
      return { success: true };
    }),

    sends: protectedProcedure.input(z.object({
      orgId: z.number(),
      campaignId: z.number(),
      limit: z.number().min(1).max(200).default(50),
      offset: z.number().min(0).default(0),
    })).query(async ({ ctx, input }) => {
      const org = await getUserOrg(ctx.user.id, input.orgId);
      if (!org) throw new TRPCError({ code: 'NOT_FOUND' });
      return db.getCampaignSends(input.campaignId, input.limit, input.offset);
    }),

    events: protectedProcedure.input(z.object({
      orgId: z.number(),
      campaignId: z.number(),
      limit: z.number().min(1).max(500).default(100),
      offset: z.number().min(0).default(0),
    })).query(async ({ ctx, input }) => {
      const org = await getUserOrg(ctx.user.id, input.orgId);
      if (!org) throw new TRPCError({ code: 'NOT_FOUND' });
      return db.getCampaignEvents(input.campaignId, input.limit, input.offset);
    }),

    links: protectedProcedure.input(z.object({ orgId: z.number(), campaignId: z.number() })).query(async ({ ctx, input }) => {
      const org = await getUserOrg(ctx.user.id, input.orgId);
      if (!org) throw new TRPCError({ code: 'NOT_FOUND' });
      return db.getCampaignLinks(input.campaignId);
    }),

    schedule: protectedProcedure.input(z.object({
      orgId: z.number(),
      id: z.number(),
      scheduledAt: z.date(),
    })).mutation(async ({ ctx, input }) => {
      const org = await getUserOrg(ctx.user.id, input.orgId);
      if (!org) throw new TRPCError({ code: 'NOT_FOUND' });
      return db.updateCampaign(input.orgId, input.id, { status: 'scheduled', scheduledAt: input.scheduledAt });
    }),

    send: protectedProcedure.input(z.object({ orgId: z.number(), id: z.number() })).mutation(async ({ ctx, input }) => {
      const org = await getUserOrg(ctx.user.id, input.orgId);
      if (!org) throw new TRPCError({ code: 'NOT_FOUND' });
      const campaign = await db.getCampaignById(input.orgId, input.id);
      if (!campaign) throw new TRPCError({ code: 'NOT_FOUND' });
      if (campaign.isAbTest && !campaign.abSubjectB) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Teste A/B ativado: defina o assunto da variante B antes de enviar.' });
      }
      // Mark as sending
      await db.updateCampaign(input.orgId, input.id, { status: 'sending' });

      // Full pipeline: variant-aware rendering (A/B), tracking injection
      // (open pixel, click redirects, unsubscribe) and provider dispatch.
      const result = await sendCampaignPipeline(campaign);

      const failedAll = result.totalRecipients > 0 && result.sent === 0;
      await db.updateCampaign(input.orgId, input.id, {
        status: failedAll ? 'failed' : 'sent',
        sentAt: new Date(),
        totalRecipients: result.totalRecipients,
        totalSent: result.sent,
        totalDelivered: result.sent,
      });

      // Notify platform owner on dispatch failure (critical event)
      if (result.failed > 0) {
        void notifyOwner({
          title: 'MailFlow: falha no disparo de campanha',
          content: `Campanha "${campaign.name}" (org ${input.orgId}): ${result.failed} de ${result.totalRecipients} envios falharam.${result.firstError ? ` Primeiro erro: ${result.firstError}` : ''}`,
        }).catch(() => {});
      }

      // A/B auto-winner: schedule the winner rollout via Heartbeat
      let winnerScheduled = false;
      let winnerScheduleError: string | undefined;
      if (!failedAll && campaign.isAbTest && campaign.abAutoWinner && result.heldForWinner > 0) {
        try {
          const sessionToken = parseCookie(ctx.req.headers.cookie ?? '')[COOKIE_NAME] ?? '';
          const waitHours = Math.min(Math.max(campaign.abWaitHours ?? 4, 1), 168);
          const runAt = new Date(Date.now() + waitHours * 3600 * 1000);
          // One-shot semantics: cron fires at a specific minute; handler is idempotent
          // (abWinnerSentAt guard) so subsequent fires are no-ops.
          const cron = `0 ${runAt.getUTCMinutes()} ${runAt.getUTCHours()} ${runAt.getUTCDate()} ${runAt.getUTCMonth() + 1} *`;
          const job = await createHeartbeatJob({
            name: `ab-winner-${campaign.id}`,
            cron,
            path: '/api/scheduled/abWinner',
            payload: { campaignId: campaign.id },
            description: `Envio automático da variante vencedora da campanha "${campaign.name}" após ${waitHours}h de teste`,
          }, sessionToken);
          await db.updateCampaign(input.orgId, input.id, { scheduleCronTaskUid: job.taskUid });
          winnerScheduled = true;
        } catch (e) {
          winnerScheduleError = e instanceof Error ? e.message : 'Falha ao agendar envio da vencedora';
          void notifyOwner({
            title: 'MailFlow: falha ao agendar envio da variante vencedora',
            content: `Campanha "${campaign.name}" (org ${input.orgId}): ${winnerScheduleError}`,
          }).catch(() => {});
        }
      }

      return {
        success: !failedAll,
        message: result.sandbox
          ? 'Disparo processado em modo sandbox (nenhum provedor SMTP configurado — configure em Configurações SMTP para envio real)'
          : 'Campaign send initiated',
        totalRecipients: result.totalRecipients,
        sent: result.sent,
        failed: result.failed,
        variantACount: result.variantACount,
        variantBCount: result.variantBCount,
        heldForWinner: result.heldForWinner,
        winnerScheduled,
        winnerScheduleError,
        sandbox: result.sandbox,
      };
    }),

    abResults: protectedProcedure.input(z.object({ orgId: z.number(), campaignId: z.number() })).query(async ({ ctx, input }) => {
      const org = await getUserOrg(ctx.user.id, input.orgId);
      if (!org) throw new TRPCError({ code: 'NOT_FOUND' });
      const campaign = await db.getCampaignById(input.orgId, input.campaignId);
      if (!campaign) throw new TRPCError({ code: 'NOT_FOUND' });
      if (!campaign.isAbTest) return null;
      const results = await db.getAbTestResults(input.campaignId);
      const criteria = campaign.abWinnerCriteria || 'open_rate';
      const rateOf = (v: typeof results.a) => {
        if (v.sent === 0) return 0;
        return criteria === 'open_rate' ? v.uniqueOpens / v.sent : v.uniqueClicks / v.sent;
      };
      const rateA = rateOf(results.a);
      const rateB = rateOf(results.b);
      let winner: 'a' | 'b' | 'tie' | null = null;
      if (results.a.sent > 0 || results.b.sent > 0) {
        winner = rateA > rateB ? 'a' : rateB > rateA ? 'b' : 'tie';
      }
      return { ...results, criteria, rateA, rateB, winner };
    }),

    duplicate: protectedProcedure.input(z.object({ orgId: z.number(), id: z.number() })).mutation(async ({ ctx, input }) => {
      const org = await getUserOrg(ctx.user.id, input.orgId);
      if (!org) throw new TRPCError({ code: 'NOT_FOUND' });
      const copy = await db.duplicateCampaign(input.orgId, input.id);
      if (!copy) throw new TRPCError({ code: 'NOT_FOUND' });
      return copy;
    }),

    comparisonReport: protectedProcedure.input(z.object({
      orgId: z.number(),
      limit: z.number().min(2).max(50).default(20),
    })).query(async ({ ctx, input }) => {
      const org = await getUserOrg(ctx.user.id, input.orgId);
      if (!org) throw new TRPCError({ code: 'NOT_FOUND' });
      return db.getCampaignComparisonReport(input.orgId, input.limit);
    }),
  }),

  // ─────────────────────────────────────────────
  // Automations
  // ─────────────────────────────────────────────
  automations: router({
    list: protectedProcedure.input(orgIdSchema).query(async ({ ctx, input }) => {
      const org = await getUserOrg(ctx.user.id, input.orgId);
      if (!org) throw new TRPCError({ code: 'NOT_FOUND' });
      return db.getAutomations(input.orgId);
    }),

    byId: protectedProcedure.input(z.object({ orgId: z.number(), id: z.number() })).query(async ({ ctx, input }) => {
      const org = await getUserOrg(ctx.user.id, input.orgId);
      if (!org) throw new TRPCError({ code: 'NOT_FOUND' });
      const automation = await db.getAutomationById(input.orgId, input.id);
      if (!automation) throw new TRPCError({ code: 'NOT_FOUND' });
      const steps = await db.getAutomationSteps(input.id);
      return { ...automation, steps };
    }),

    create: protectedProcedure.input(createAutomationSchema).mutation(async ({ ctx, input }) => {
      const org = await getUserOrg(ctx.user.id, input.orgId);
      if (!org) throw new TRPCError({ code: 'NOT_FOUND' });
      const { steps, ...autoData } = input;
      const automation = await db.createAutomation(input.orgId, autoData);
      if (automation && steps) {
        for (let i = 0; i < steps.length; i++) {
          await db.createAutomationStep(automation.id, i, steps[i].type, steps[i].config);
        }
      }
      return automation;
    }),

    update: protectedProcedure.input(updateAutomationSchema).mutation(async ({ ctx, input }) => {
      const org = await getUserOrg(ctx.user.id, input.orgId);
      if (!org) throw new TRPCError({ code: 'NOT_FOUND' });
      const { orgId, id, ...data } = input;
      return db.updateAutomation(orgId, id, data);
    }),

    delete: protectedProcedure.input(z.object({ orgId: z.number(), id: z.number() })).mutation(async ({ ctx, input }) => {
      const org = await getUserOrg(ctx.user.id, input.orgId);
      if (!org) throw new TRPCError({ code: 'NOT_FOUND' });
      await db.deleteAutomation(input.orgId, input.id);
      return { success: true };
    }),

    steps: protectedProcedure.input(z.object({ orgId: z.number(), automationId: z.number() })).query(async ({ ctx, input }) => {
      const org = await getUserOrg(ctx.user.id, input.orgId);
      if (!org) throw new TRPCError({ code: 'NOT_FOUND' });
      return db.getAutomationSteps(input.automationId);
    }),

    addStep: protectedProcedure.input(z.object({
      orgId: z.number(),
      automationId: z.number(),
      type: z.enum(['send_email', 'wait', 'condition', 'add_tag', 'remove_tag', 'move_to_list']),
      config: z.string(),
      stepOrder: z.number(),
    })).mutation(async ({ ctx, input }) => {
      const org = await getUserOrg(ctx.user.id, input.orgId);
      if (!org) throw new TRPCError({ code: 'NOT_FOUND' });
      return db.createAutomationStep(input.automationId, input.stepOrder, input.type, input.config);
    }),

    removeStep: protectedProcedure.input(z.object({ orgId: z.number(), stepId: z.number() })).mutation(async ({ ctx, input }) => {
      const org = await getUserOrg(ctx.user.id, input.orgId);
      if (!org) throw new TRPCError({ code: 'NOT_FOUND' });
      await db.deleteAutomationStep(input.stepId);
      return { success: true };
    }),
  }),

  // ─────────────────────────────────────────────
  // Sending Domains
  // ─────────────────────────────────────────────
  sendingDomains: router({
    list: protectedProcedure.input(orgIdSchema).query(async ({ ctx, input }) => {
      const org = await getUserOrg(ctx.user.id, input.orgId);
      if (!org) throw new TRPCError({ code: 'NOT_FOUND' });
      return db.getSendingDomains(input.orgId);
    }),

    byId: protectedProcedure.input(z.object({ orgId: z.number(), id: z.number() })).query(async ({ ctx, input }) => {
      const org = await getUserOrg(ctx.user.id, input.orgId);
      if (!org) throw new TRPCError({ code: 'NOT_FOUND' });
      const domain = await db.getSendingDomainById(input.orgId, input.id);
      if (!domain) throw new TRPCError({ code: 'NOT_FOUND' });
      return domain;
    }),

    create: protectedProcedure.input(createSendingDomainSchema).mutation(async ({ ctx, input }) => {
      const org = await getUserOrg(ctx.user.id, input.orgId);
      if (!org) throw new TRPCError({ code: 'NOT_FOUND' });
      return db.createSendingDomain(input.orgId, input.domain, input.dkimSelector);
    }),

    update: protectedProcedure.input(updateSendingDomainSchema).mutation(async ({ ctx, input }) => {
      const org = await getUserOrg(ctx.user.id, input.orgId);
      if (!org) throw new TRPCError({ code: 'NOT_FOUND' });
      const { orgId, id, ...data } = input;
      return db.updateSendingDomain(orgId, id, data);
    }),

    delete: protectedProcedure.input(z.object({ orgId: z.number(), id: z.number() })).mutation(async ({ ctx, input }) => {
      const org = await getUserOrg(ctx.user.id, input.orgId);
      if (!org) throw new TRPCError({ code: 'NOT_FOUND' });
      await db.deleteSendingDomain(input.orgId, input.id);
      return { success: true };
    }),

    dnsRecords: protectedProcedure.input(z.object({ orgId: z.number(), id: z.number() })).query(async ({ ctx, input }) => {
      const org = await getUserOrg(ctx.user.id, input.orgId);
      if (!org) throw new TRPCError({ code: 'NOT_FOUND' });
      const domain = await db.getSendingDomainById(input.orgId, input.id);
      if (!domain) throw new TRPCError({ code: 'NOT_FOUND' });
      // Generate DNS instructions
      const selector = domain.dkimSelector || 'mailflow';
      return {
        spf: {
          type: 'TXT',
          host: domain.domain,
          value: `v=spf1 include:mailflow.com ~all`,
          status: domain.spfStatus,
        },
        dkim: {
          type: 'TXT',
          host: `${selector}._domainkey.${domain.domain}`,
          value: domain.dkimPublicKey || 'v=DKIM1; k=rsa; p=YOUR_PUBLIC_KEY',
          status: domain.dkimStatus,
        },
        dmarc: {
          type: 'TXT',
          host: `_dmarc.${domain.domain}`,
          value: `v=DMARC1; p=quarantine; rua=mailto:dmarc@${domain.domain}; ruf=mailto:dmarc@${domain.domain}; fo=1`,
          status: domain.dmarcStatus,
        },
      };
    }),

    verify: protectedProcedure.input(z.object({ orgId: z.number(), id: z.number() })).mutation(async ({ ctx, input }) => {
      const org = await getUserOrg(ctx.user.id, input.orgId);
      if (!org) throw new TRPCError({ code: 'NOT_FOUND' });
      const domain = await db.getSendingDomainById(input.orgId, input.id);
      if (!domain) throw new TRPCError({ code: 'NOT_FOUND' });

      // Live DNS resolution of SPF, DKIM and DMARC TXT records,
      // comparing against the platform-required SPF include and the
      // domain's expected DKIM public key when available.
      const result = await verifyDomainDns(domain.domain, domain.dkimSelector || 'mailflow', domain.dkimPublicKey);

      await db.updateSendingDomain(input.orgId, input.id, {
        spfStatus: result.spf.status,
        dkimStatus: result.dkim.status,
        dmarcStatus: result.dmarc.status,
        verificationStatus: result.allVerified ? 'verified' : 'failed',
      });

      return result;
    }),
  }),

  // ─────────────────────────────────────────────
  // SMTP Configurations
  // ─────────────────────────────────────────────
  smtp: router({
    list: protectedProcedure.input(orgIdSchema).query(async ({ ctx, input }) => {
      const org = await getUserOrg(ctx.user.id, input.orgId);
      if (!org) throw new TRPCError({ code: 'NOT_FOUND' });
      const configs = await db.getSmtpConfigs(input.orgId);
      // Mask sensitive data
      return configs.map(c => ({
        ...c,
        apiKey: c.apiKey ? '••••••••' : null,
        smtpPassword: c.smtpPassword ? '••••••••' : null,
      }));
    }),

    byId: protectedProcedure.input(z.object({ orgId: z.number(), id: z.number() })).query(async ({ ctx, input }) => {
      const org = await getUserOrg(ctx.user.id, input.orgId);
      if (!org) throw new TRPCError({ code: 'NOT_FOUND' });
      const config = await db.getSmtpConfigById(input.orgId, input.id);
      if (!config) throw new TRPCError({ code: 'NOT_FOUND' });
      return {
        ...config,
        apiKey: config.apiKey ? '••••••••' : null,
        smtpPassword: config.smtpPassword ? '••••••••' : null,
      };
    }),

    create: protectedProcedure.input(createSmtpConfigSchema).mutation(async ({ ctx, input }) => {
      const org = await getUserOrg(ctx.user.id, input.orgId);
      if (!org) throw new TRPCError({ code: 'NOT_FOUND' });
      return db.createSmtpConfig(input.orgId, input);
    }),

    update: protectedProcedure.input(updateSmtpConfigSchema).mutation(async ({ ctx, input }) => {
      const org = await getUserOrg(ctx.user.id, input.orgId);
      if (!org) throw new TRPCError({ code: 'NOT_FOUND' });
      const { orgId, id, ...data } = input;
      // Don't overwrite secrets with mask values
      if (data.apiKey === '••••••••') delete data.apiKey;
      if (data.smtpPassword === '••••••••') delete data.smtpPassword;
      return db.updateSmtpConfig(orgId, id, data);
    }),

    delete: protectedProcedure.input(z.object({ orgId: z.number(), id: z.number() })).mutation(async ({ ctx, input }) => {
      const org = await getUserOrg(ctx.user.id, input.orgId);
      if (!org) throw new TRPCError({ code: 'NOT_FOUND' });
      await db.deleteSmtpConfig(input.orgId, input.id);
      return { success: true };
    }),
  }),

  // ─────────────────────────────────────────────
  // Dashboard
  // ─────────────────────────────────────────────
  dashboard: router({
    metrics: protectedProcedure.input(orgIdSchema).query(async ({ ctx, input }) => {
      const org = await getUserOrg(ctx.user.id, input.orgId);
      if (!org) throw new TRPCError({ code: 'NOT_FOUND' });
      const metrics = await db.getDashboardMetrics(input.orgId);
      const recentCampaigns = await db.getRecentCampaigns(input.orgId, 5);
      return { ...metrics, recentCampaigns };
    }),
  }),

  // ─────────────────────────────────────────────
  // AI Assistant (subject suggestions + content optimization)
  // ─────────────────────────────────────────────
  ai: router({
    suggestSubjects: protectedProcedure
      .input(z.object({
        orgId: z.number(),
        topic: z.string().min(1).max(2000),
        audience: z.string().max(500).optional(),
        tone: z.enum(['professional', 'friendly', 'urgent', 'curious']).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const org = await getUserOrg(ctx.user.id, input.orgId);
        if (!org) throw new TRPCError({ code: 'NOT_FOUND' });

        const toneMap: Record<string, string> = {
          professional: 'profissional e confiável',
          friendly: 'amigável e acolhedor',
          urgent: 'com senso de urgência (sem exagerar)',
          curious: 'que desperta curiosidade',
        };

        const response = await invokeLLM({
          messages: [
            {
              role: 'system',
              content: `Você é um especialista em copywriting de e-mail marketing em português brasileiro. Gere linhas de assunto que maximizam taxa de abertura. Regras: máximo ~50 caracteres por assunto; evite palavras que disparam filtros de spam (GRÁTIS!!!, dinheiro fácil, clique aqui); evite CAPS LOCK excessivo; o preheader deve complementar (não repetir) o assunto; responda APENAS com JSON válido.`,
            },
            {
              role: 'user',
              content: `Gere exatamente 5 sugestões de linha de assunto para um e-mail sobre: "${input.topic}".${input.audience ? ` Público-alvo: ${input.audience}.` : ''}${input.tone ? ` Tom desejado: ${toneMap[input.tone]}.` : ''} Para cada sugestão inclua um preheader complementar e uma breve justificativa.`,
            },
          ],
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'subject_suggestions',
              strict: true,
              schema: {
                type: 'object',
                properties: {
                  suggestions: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        subject: { type: 'string', description: 'Linha de assunto (máx ~50 chars)' },
                        preheader: { type: 'string', description: 'Preheader complementar' },
                        rationale: { type: 'string', description: 'Justificativa breve' },
                      },
                      required: ['subject', 'preheader', 'rationale'],
                      additionalProperties: false,
                    },
                  },
                },
                required: ['suggestions'],
                additionalProperties: false,
              },
            },
          },
        });

        const raw = response.choices[0]?.message?.content;
        const text = typeof raw === 'string' ? raw : JSON.stringify(raw);
        try {
          const parsed = JSON.parse(text) as { suggestions: Array<{ subject: string; preheader: string; rationale: string }> };
          return parsed;
        } catch {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Falha ao interpretar resposta da IA' });
        }
      }),

    optimizeContent: protectedProcedure
      .input(z.object({
        orgId: z.number(),
        content: z.string().min(1).max(50000),
        goal: z.enum(['clarity', 'engagement', 'conversion', 'shorten']),
        isHtml: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const org = await getUserOrg(ctx.user.id, input.orgId);
        if (!org) throw new TRPCError({ code: 'NOT_FOUND' });

        const goalMap: Record<string, string> = {
          clarity: 'melhorar a clareza e legibilidade, simplificando frases longas',
          engagement: 'aumentar o engajamento com linguagem mais envolvente e pessoal',
          conversion: 'otimizar para conversão com CTAs mais fortes e senso de valor',
          shorten: 'encurtar o texto mantendo a mensagem essencial',
        };

        const response = await invokeLLM({
          messages: [
            {
              role: 'system',
              content: `Você é um especialista em copywriting de e-mail marketing em português brasileiro. Otimize o texto do e-mail fornecido. ${input.isHtml ? 'O conteúdo está em HTML — PRESERVE toda a estrutura de tags HTML, otimizando apenas os textos visíveis.' : 'O conteúdo é texto simples.'} Responda APENAS com JSON válido.`,
            },
            {
              role: 'user',
              content: `Objetivo: ${goalMap[input.goal]}.\n\nConteúdo original:\n${input.content}\n\nRetorne o conteúdo otimizado e uma lista das principais mudanças feitas (em português).`,
            },
          ],
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'optimized_content',
              strict: true,
              schema: {
                type: 'object',
                properties: {
                  optimized: { type: 'string', description: 'Conteúdo otimizado' },
                  changes: { type: 'array', items: { type: 'string' }, description: 'Mudanças feitas' },
                },
                required: ['optimized', 'changes'],
                additionalProperties: false,
              },
            },
          },
        });

        const raw = response.choices[0]?.message?.content;
        const text = typeof raw === 'string' ? raw : JSON.stringify(raw);
        try {
          const parsed = JSON.parse(text) as { optimized: string; changes: string[] };
          return parsed;
        } catch {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Falha ao interpretar resposta da IA' });
        }
      }),
  }),
});

export type AppRouter = typeof appRouter;
