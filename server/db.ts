import { eq, and, sql, desc, asc, inArray, like, or, gte, lte, ne, isNull, count } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  users,
  organizations,
  organizationMembers,
  contacts,
  contactLists,
  contactListMemberships,
  contactTags,
  contactTagAssociations,
  customFields,
  customFieldValues,
  segments,
  emailTemplates,
  campaigns,
  campaignSends,
  emailLinks,
  emailEvents,
  automations,
  automationSteps,
  automationEnrollments,
  sendingDomains,
  smtpConfigurations,
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─────────────────────────────────────────────
// User queries (from template)
// ─────────────────────────────────────────────
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;
    textFields.forEach((field) => {
      const value = user[field];
      if (value !== undefined) {
        const normalized = value ?? null;
        values[field] = normalized;
        updateSet[field] = normalized;
      }
    });
    if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
    if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
    else if (user.openId === ENV.ownerOpenId) { values.role = 'admin'; updateSet.role = 'admin'; }
    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ─────────────────────────────────────────────
// Organization queries
// ─────────────────────────────────────────────
export async function createOrg(name: string, slug: string, ownerId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(organizations).values({ name, slug, ownerId });
  const orgId = (result as any)[0]?.insertId ?? (result as any).insertId;
  // Add owner as admin member
  await db.insert(organizationMembers).values({ orgId, userId: ownerId, role: 'admin', status: 'active' });
  return getOrgById(orgId);
}

export async function getOrgById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(organizations).where(eq(organizations.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getOrgsByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const result = await db
    .select({
      org: organizations,
      member: organizationMembers,
    })
    .from(organizations)
    .innerJoin(organizationMembers, eq(organizations.id, organizationMembers.orgId))
    .where(and(eq(organizationMembers.userId, userId), ne(organizationMembers.status, 'removed')));
  return result;
}

export async function updateOrg(id: number, data: Partial<typeof organizations.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(organizations).set(data).where(eq(organizations.id, id));
  return getOrgById(id);
}

// ─────────────────────────────────────────────
// Organization member queries
// ─────────────────────────────────────────────
export async function getOrgMembers(orgId: number) {
  const db = await getDb();
  if (!db) return [];
  const result = await db
    .select({
      member: organizationMembers,
      user: users,
    })
    .from(organizationMembers)
    .innerJoin(users, eq(organizationMembers.userId, users.id))
    .where(and(eq(organizationMembers.orgId, orgId), ne(organizationMembers.status, 'removed')));
  return result;
}

export async function getOrgMember(orgId: number, userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(organizationMembers)
    .where(and(eq(organizationMembers.orgId, orgId), eq(organizationMembers.userId, userId)))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function addOrgMember(orgId: number, userId: number, role: 'admin' | 'member' = 'member', invitedEmail?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await getOrgMember(orgId, userId);
  if (existing) {
    await db.update(organizationMembers).set({ role, status: 'active' }).where(eq(organizationMembers.id, existing.id));
    return getOrgMember(orgId, userId);
  }
  await db.insert(organizationMembers).values({ orgId, userId, role, invitedEmail, status: 'active' });
  return getOrgMember(orgId, userId);
}

export async function updateOrgMember(orgId: number, userId: number, data: Partial<typeof organizationMembers.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(organizationMembers).set(data).where(and(eq(organizationMembers.orgId, orgId), eq(organizationMembers.userId, userId)));
  return getOrgMember(orgId, userId);
}

export async function removeOrgMember(orgId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(organizationMembers).set({ status: 'removed' }).where(and(eq(organizationMembers.orgId, orgId), eq(organizationMembers.userId, userId)));
}

// ─────────────────────────────────────────────
// Contact queries
// ─────────────────────────────────────────────
export async function getContacts(orgId: number, limit = 50, offset = 0, search?: string) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(contacts.orgId, orgId)];
  if (search) {
    conditions.push(or(like(contacts.email, `%${search}%`), like(contacts.firstName, `%${search}%`), like(contacts.lastName, `%${search}%`)) as any);
  }
  const result = await db.select().from(contacts).where(and(...conditions)).orderBy(desc(contacts.createdAt)).limit(limit).offset(offset);
  return result;
}

export async function getContactById(orgId: number, id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(contacts).where(and(eq(contacts.id, id), eq(contacts.orgId, orgId))).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getContactByEmail(orgId: number, email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(contacts).where(and(eq(contacts.orgId, orgId), eq(contacts.email, email))).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createContact(orgId: number, data: Partial<typeof contacts.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await getContactByEmail(orgId, data.email!);
  if (existing) return existing;
  await db.insert(contacts).values({ orgId, ...data } as any);
  return getContactByEmail(orgId, data.email!);
}

export async function updateContact(orgId: number, id: number, data: Partial<typeof contacts.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(contacts).set(data).where(and(eq(contacts.id, id), eq(contacts.orgId, orgId)));
  return getContactById(orgId, id);
}

export async function deleteContact(orgId: number, id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(contacts).where(and(eq(contacts.id, id), eq(contacts.orgId, orgId)));
  await db.delete(contactListMemberships).where(eq(contactListMemberships.contactId, id));
  await db.delete(contactTagAssociations).where(eq(contactTagAssociations.contactId, id));
  await db.delete(customFieldValues).where(eq(customFieldValues.contactId, id));
}

export async function bulkImportContacts(orgId: number, contactsData: Array<{ email: string; firstName?: string; lastName?: string; phone?: string }>, listId?: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  let imported = 0;
  let updated = 0;
  for (const c of contactsData) {
    const existing = await getContactByEmail(orgId, c.email);
    if (existing) {
      await db.update(contacts).set({ firstName: c.firstName, lastName: c.lastName, phone: c.phone }).where(eq(contacts.id, existing.id));
      updated++;
      if (listId) {
        const membership = await db.select().from(contactListMemberships).where(and(eq(contactListMemberships.contactId, existing.id), eq(contactListMemberships.listId, listId))).limit(1);
        if (membership.length === 0) {
          await db.insert(contactListMemberships).values({ contactId: existing.id, listId });
        }
      }
    } else {
      await db.insert(contacts).values({ orgId, email: c.email, firstName: c.firstName, lastName: c.lastName, phone: c.phone, source: 'import' });
      const newContact = await getContactByEmail(orgId, c.email);
      if (newContact && listId) {
        await db.insert(contactListMemberships).values({ contactId: newContact.id, listId });
      }
      imported++;
    }
  }
  return { imported, updated };
}

export async function getContactCount(orgId: number) {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ count: count() }).from(contacts).where(eq(contacts.orgId, orgId));
  return result[0]?.count ?? 0;
}

// ─────────────────────────────────────────────
// Contact list queries
// ─────────────────────────────────────────────
export async function getLists(orgId: number) {
  const db = await getDb();
  if (!db) return [];
  const result = await db.select().from(contactLists).where(eq(contactLists.orgId, orgId)).orderBy(desc(contactLists.createdAt));
  return result;
}

export async function getListById(orgId: number, id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(contactLists).where(and(eq(contactLists.id, id), eq(contactLists.orgId, orgId))).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createList(orgId: number, name: string, description?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(contactLists).values({ orgId, name, description });
  const result = await db.select().from(contactLists).where(eq(contactLists.name, name)).orderBy(desc(contactLists.id)).limit(1);
  return result[0];
}

export async function updateList(orgId: number, id: number, data: Partial<typeof contactLists.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(contactLists).set(data).where(and(eq(contactLists.id, id), eq(contactLists.orgId, orgId)));
  return getListById(orgId, id);
}

export async function deleteList(orgId: number, id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(contactListMemberships).where(eq(contactListMemberships.listId, id));
  await db.delete(contactLists).where(and(eq(contactLists.id, id), eq(contactLists.orgId, orgId)));
}

export async function getListMembers(orgId: number, listId: number, limit = 50, offset = 0) {
  const db = await getDb();
  if (!db) return [];
  const result = await db
    .select({ contact: contacts, membership: contactListMemberships })
    .from(contactListMemberships)
    .innerJoin(contacts, eq(contactListMemberships.contactId, contacts.id))
    .where(and(eq(contactListMemberships.listId, listId), eq(contacts.orgId, orgId)))
    .orderBy(desc(contactListMemberships.createdAt))
    .limit(limit)
    .offset(offset);
  return result;
}

export async function getListMemberCount(listId: number) {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ count: count() }).from(contactListMemberships).where(eq(contactListMemberships.listId, listId));
  return result[0]?.count ?? 0;
}

export async function addContactToList(contactId: number, listId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await db.select().from(contactListMemberships).where(and(eq(contactListMemberships.contactId, contactId), eq(contactListMemberships.listId, listId))).limit(1);
  if (existing.length === 0) {
    await db.insert(contactListMemberships).values({ contactId, listId });
  }
}

export async function removeContactFromList(contactId: number, listId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(contactListMemberships).where(and(eq(contactListMemberships.contactId, contactId), eq(contactListMemberships.listId, listId)));
}

// ─────────────────────────────────────────────
// Tag queries
// ─────────────────────────────────────────────
export async function getTags(orgId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(contactTags).where(eq(contactTags.orgId, orgId)).orderBy(desc(contactTags.createdAt));
}

export async function createTag(orgId: number, name: string, color?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(contactTags).values({ orgId, name, color });
  const result = await db.select().from(contactTags).where(and(eq(contactTags.orgId, orgId), eq(contactTags.name, name))).orderBy(desc(contactTags.id)).limit(1);
  return result[0];
}

export async function deleteTag(orgId: number, id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(contactTagAssociations).where(eq(contactTagAssociations.tagId, id));
  await db.delete(contactTags).where(and(eq(contactTags.id, id), eq(contactTags.orgId, orgId)));
}

export async function getContactTags(contactId: number) {
  const db = await getDb();
  if (!db) return [];
  const result = await db
    .select({ tag: contactTags })
    .from(contactTagAssociations)
    .innerJoin(contactTags, eq(contactTagAssociations.tagId, contactTags.id))
    .where(eq(contactTagAssociations.contactId, contactId));
  return result.map(r => r.tag);
}

export async function addTagToContact(contactId: number, tagId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await db.select().from(contactTagAssociations).where(and(eq(contactTagAssociations.contactId, contactId), eq(contactTagAssociations.tagId, tagId))).limit(1);
  if (existing.length === 0) {
    await db.insert(contactTagAssociations).values({ contactId, tagId });
  }
}

export async function removeTagFromContact(contactId: number, tagId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(contactTagAssociations).where(and(eq(contactTagAssociations.contactId, contactId), eq(contactTagAssociations.tagId, tagId)));
}

// ─────────────────────────────────────────────
// Custom field queries
// ─────────────────────────────────────────────
export async function getCustomFields(orgId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(customFields).where(eq(customFields.orgId, orgId)).orderBy(desc(customFields.createdAt));
}

export async function createCustomField(orgId: number, name: string, key: string, type: string, options?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(customFields).values({ orgId, name, key, type: type as any, options });
  const result = await db.select().from(customFields).where(and(eq(customFields.orgId, orgId), eq(customFields.key, key))).orderBy(desc(customFields.id)).limit(1);
  return result[0];
}

export async function deleteCustomField(orgId: number, id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(customFieldValues).where(eq(customFieldValues.fieldId, id));
  await db.delete(customFields).where(and(eq(customFields.id, id), eq(customFields.orgId, orgId)));
}

export async function getContactCustomValues(contactId: number) {
  const db = await getDb();
  if (!db) return [];
  const result = await db
    .select({ value: customFieldValues, field: customFields })
    .from(customFieldValues)
    .innerJoin(customFields, eq(customFieldValues.fieldId, customFields.id))
    .where(eq(customFieldValues.contactId, contactId));
  return result;
}

// ─────────────────────────────────────────────
// Segment queries
// ─────────────────────────────────────────────
export async function getSegments(orgId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(segments).where(eq(segments.orgId, orgId)).orderBy(desc(segments.createdAt));
}

export async function getSegmentById(orgId: number, id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(segments).where(and(eq(segments.id, id), eq(segments.orgId, orgId))).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createSegment(orgId: number, name: string, rules: string, matchType: string, description?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(segments).values({ orgId, name, rules, matchType: matchType as any, description });
  const result = await db.select().from(segments).where(and(eq(segments.orgId, orgId), eq(segments.name, name))).orderBy(desc(segments.id)).limit(1);
  return result[0];
}

export async function updateSegment(orgId: number, id: number, data: Partial<typeof segments.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(segments).set(data).where(and(eq(segments.id, id), eq(segments.orgId, orgId)));
  return getSegmentById(orgId, id);
}

export async function deleteSegment(orgId: number, id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(segments).where(and(eq(segments.id, id), eq(segments.orgId, orgId)));
}

export async function getSegmentContactCount(orgId: number, segmentId: number): Promise<number> {
  const segment = await getSegmentById(orgId, segmentId);
  if (!segment) return 0;
  // Simplified: count contacts in org with matching criteria
  // For production, parse rules JSON and build dynamic query
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ count: count() }).from(contacts).where(eq(contacts.orgId, orgId));
  return result[0]?.count ?? 0;
}

// ─────────────────────────────────────────────
// Email template queries
// ─────────────────────────────────────────────
export async function getTemplates(orgId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(emailTemplates).where(eq(emailTemplates.orgId, orgId)).orderBy(desc(emailTemplates.createdAt));
}

export async function getTemplateById(orgId: number, id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(emailTemplates).where(and(eq(emailTemplates.id, id), eq(emailTemplates.orgId, orgId))).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createTemplate(orgId: number, data: Partial<typeof emailTemplates.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(emailTemplates).values({ orgId, ...data } as any);
  const result = await db.select().from(emailTemplates).where(eq(emailTemplates.orgId, orgId)).orderBy(desc(emailTemplates.id)).limit(1);
  return result[0];
}

export async function updateTemplate(orgId: number, id: number, data: Partial<typeof emailTemplates.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(emailTemplates).set(data).where(and(eq(emailTemplates.id, id), eq(emailTemplates.orgId, orgId)));
  return getTemplateById(orgId, id);
}

export async function deleteTemplate(orgId: number, id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(emailTemplates).where(and(eq(emailTemplates.id, id), eq(emailTemplates.orgId, orgId)));
}

// ─────────────────────────────────────────────
// Campaign queries
// ─────────────────────────────────────────────
export async function getCampaigns(orgId: number, limit = 50, offset = 0) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(campaigns).where(eq(campaigns.orgId, orgId)).orderBy(desc(campaigns.createdAt)).limit(limit).offset(offset);
}

export async function getCampaignById(orgId: number, id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(campaigns).where(and(eq(campaigns.id, id), eq(campaigns.orgId, orgId))).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createCampaign(orgId: number, data: Partial<typeof campaigns.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(campaigns).values({ orgId, ...data } as any);
  const result = await db.select().from(campaigns).where(eq(campaigns.orgId, orgId)).orderBy(desc(campaigns.id)).limit(1);
  return result[0];
}

export async function updateCampaign(orgId: number, id: number, data: Partial<typeof campaigns.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(campaigns).set(data).where(and(eq(campaigns.id, id), eq(campaigns.orgId, orgId)));
  return getCampaignById(orgId, id);
}

export async function deleteCampaign(orgId: number, id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(campaignSends).where(eq(campaignSends.campaignId, id));
  await db.delete(emailEvents).where(eq(emailEvents.campaignId, id));
  await db.delete(emailLinks).where(eq(emailLinks.campaignId, id));
  await db.delete(campaigns).where(and(eq(campaigns.id, id), eq(campaigns.orgId, orgId)));
}

export async function getCampaignRecipients(orgId: number, listId?: number) {
  const db = await getDb();
  if (!db) return [];
  if (listId) {
    const rows = await db
      .select({ id: contacts.id, email: contacts.email })
      .from(contactListMemberships)
      .innerJoin(contacts, eq(contactListMemberships.contactId, contacts.id))
      .where(and(eq(contactListMemberships.listId, listId), eq(contacts.orgId, orgId), eq(contacts.status, 'subscribed')));
    return rows;
  }
  return await db
    .select({ id: contacts.id, email: contacts.email })
    .from(contacts)
    .where(and(eq(contacts.orgId, orgId), eq(contacts.status, 'subscribed')));
}

export async function createCampaignSend(campaignId: number, contactId: number, recipientEmail: string, variant: 'a' | 'b' = 'a') {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(campaignSends).values({
    campaignId,
    contactId,
    recipientEmail,
    variant,
    status: 'sent',
    sentAt: new Date(),
    deliveredAt: new Date(),
  });
}

export async function createCampaignSendFull(
  campaignId: number,
  contactId: number,
  recipientEmail: string,
  variant: 'a' | 'b',
  status: 'sent' | 'failed',
  messageId?: string,
  error?: string,
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(campaignSends).values({
    campaignId,
    contactId,
    recipientEmail,
    variant,
    status,
    message_id: messageId,
    error,
    sentAt: status === 'sent' ? new Date() : undefined,
    deliveredAt: status === 'sent' ? new Date() : undefined,
  });
}

export async function getAbTestResults(campaignId: number) {
  const db = await getDb();
  const empty = { sent: 0, uniqueOpens: 0, uniqueClicks: 0, bounces: 0 };
  if (!db) return { a: { ...empty }, b: { ...empty } };

  // Sends per variant
  const sendRows = await db
    .select({ variant: campaignSends.variant, total: count() })
    .from(campaignSends)
    .where(eq(campaignSends.campaignId, campaignId))
    .groupBy(campaignSends.variant);

  // Events per variant (join events -> sends by contact for variant attribution)
  const eventRows = await db
    .select({
      variant: campaignSends.variant,
      type: emailEvents.type,
      contacts: sql<number>`COUNT(DISTINCT ${emailEvents.contactId})`,
    })
    .from(emailEvents)
    .innerJoin(campaignSends, and(
      eq(emailEvents.campaignId, campaignSends.campaignId),
      eq(emailEvents.contactId, campaignSends.contactId),
    ))
    .where(eq(emailEvents.campaignId, campaignId))
    .groupBy(campaignSends.variant, emailEvents.type);

  const result = { a: { ...empty }, b: { ...empty } };
  for (const row of sendRows) {
    const v = row.variant === 'b' ? 'b' : 'a';
    result[v].sent = Number(row.total);
  }
  for (const row of eventRows) {
    const v = row.variant === 'b' ? 'b' : 'a';
    if (row.type === 'open') result[v].uniqueOpens = Number(row.contacts);
    else if (row.type === 'click') result[v].uniqueClicks = Number(row.contacts);
    else if (row.type === 'bounce') result[v].bounces = Number(row.contacts);
  }
  return result;
}

export async function getCampaignSends(campaignId: number, limit = 50, offset = 0) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(campaignSends).where(eq(campaignSends.campaignId, campaignId)).orderBy(desc(campaignSends.createdAt)).limit(limit).offset(offset);
}

export async function getCampaignEvents(campaignId: number, limit = 100, offset = 0) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(emailEvents).where(eq(emailEvents.campaignId, campaignId)).orderBy(desc(emailEvents.createdAt)).limit(limit).offset(offset);
}

export async function getCampaignLinks(campaignId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(emailLinks).where(eq(emailLinks.campaignId, campaignId)).orderBy(desc(emailLinks.totalClicks));
}

// ─────────────────────────────────────────────
// Email link queries
// ─────────────────────────────────────────────
export async function getEmailLinkByShortId(shortId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(emailLinks).where(eq(emailLinks.shortId, shortId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function incrementLinkClicks(linkId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(emailLinks).set({ totalClicks: sql`${emailLinks.totalClicks} + 1` }).where(eq(emailLinks.id, linkId));
}

export async function createEmailLink(campaignId: number, url: string, shortId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(emailLinks).values({ campaignId, url, shortId });
  const result = await db.select().from(emailLinks).where(eq(emailLinks.shortId, shortId)).limit(1);
  return result[0];
}

export async function getOrCreateEmailLink(campaignId: number, url: string) {
  const db = await getDb();
  if (!db) return undefined;
  const existing = await db.select().from(emailLinks).where(and(eq(emailLinks.campaignId, campaignId), eq(emailLinks.url, url))).limit(1);
  if (existing.length > 0) return existing[0];
  const shortId = Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  return createEmailLink(campaignId, url, shortId);
}

// ─────────────────────────────────────────────
// Email event queries
// ─────────────────────────────────────────────
export async function createEmailEvent(data: Partial<typeof emailEvents.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(emailEvents).values(data as any);
}

export async function recordOpenEvent(campaignId: number, sendId: number | null, contactId: number | null, userAgent?: string, ipAddress?: string) {
  const db = await getDb();
  if (!db) return;
  await createEmailEvent({ campaignId, sendId, contactId, type: 'open', userAgent, ipAddress });
  await db.update(campaigns).set({
    totalOpens: sql`${campaigns.totalOpens} + 1`,
  }).where(eq(campaigns.id, campaignId));
  // Increment unique opens only if this contact hasn't opened before
  if (contactId) {
    const existing = await db.select().from(emailEvents).where(and(eq(emailEvents.campaignId, campaignId), eq(emailEvents.contactId, contactId), eq(emailEvents.type, 'open'))).limit(2);
    if (existing.length === 1) {
      await db.update(campaigns).set({
        totalUniqueOpens: sql`${campaigns.totalUniqueOpens} + 1`,
      }).where(eq(campaigns.id, campaignId));
    }
  }
}

export async function recordClickEvent(campaignId: number, sendId: number | null, contactId: number | null, url: string, userAgent?: string, ipAddress?: string) {
  const db = await getDb();
  if (!db) return;
  await createEmailEvent({ campaignId, sendId, contactId, type: 'click', url, userAgent, ipAddress });
  await db.update(campaigns).set({
    totalClicks: sql`${campaigns.totalClicks} + 1`,
  }).where(eq(campaigns.id, campaignId));
  if (contactId) {
    const existing = await db.select().from(emailEvents).where(and(eq(emailEvents.campaignId, campaignId), eq(emailEvents.contactId, contactId), eq(emailEvents.type, 'click'))).limit(2);
    if (existing.length === 1) {
      await db.update(campaigns).set({
        totalUniqueClicks: sql`${campaigns.totalUniqueClicks} + 1`,
      }).where(eq(campaigns.id, campaignId));
    }
  }
}

export async function recordBounceEvent(campaignId: number, sendId: number | null, contactId: number | null, reason?: string) {
  const db = await getDb();
  if (!db) return;
  await createEmailEvent({ campaignId, sendId, contactId, type: 'bounce', bounceReason: reason });
  await db.update(campaigns).set({
    totalBounces: sql`${campaigns.totalBounces} + 1`,
  }).where(eq(campaigns.id, campaignId));
  if (contactId) {
    await db.update(contacts).set({ status: 'bounced' }).where(eq(contacts.id, contactId));
  }
}

export async function recordUnsubscribeEvent(campaignId: number, sendId: number | null, contactId: number | null) {
  const db = await getDb();
  if (!db) return;
  await createEmailEvent({ campaignId, sendId, contactId, type: 'unsubscribe' });
  await db.update(campaigns).set({
    totalUnsubscribes: sql`${campaigns.totalUnsubscribes} + 1`,
  }).where(eq(campaigns.id, campaignId));
  if (contactId) {
    await db.update(contacts).set({ status: 'unsubscribed' }).where(eq(contacts.id, contactId));
  }
}

// ─────────────────────────────────────────────
// Automation queries
// ─────────────────────────────────────────────
export async function getAutomations(orgId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(automations).where(eq(automations.orgId, orgId)).orderBy(desc(automations.createdAt));
}

export async function getAutomationById(orgId: number, id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(automations).where(and(eq(automations.id, id), eq(automations.orgId, orgId))).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createAutomation(orgId: number, data: Partial<typeof automations.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(automations).values({ orgId, ...data } as any);
  const result = await db.select().from(automations).where(eq(automations.orgId, orgId)).orderBy(desc(automations.id)).limit(1);
  return result[0];
}

export async function updateAutomation(orgId: number, id: number, data: Partial<typeof automations.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(automations).set(data).where(and(eq(automations.id, id), eq(automations.orgId, orgId)));
  return getAutomationById(orgId, id);
}

export async function deleteAutomation(orgId: number, id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(automationSteps).where(eq(automationSteps.automationId, id));
  await db.delete(automationEnrollments).where(eq(automationEnrollments.automationId, id));
  await db.delete(automations).where(and(eq(automations.id, id), eq(automations.orgId, orgId)));
}

export async function getAutomationSteps(automationId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(automationSteps).where(eq(automationSteps.automationId, automationId)).orderBy(asc(automationSteps.stepOrder));
}

export async function createAutomationStep(automationId: number, stepOrder: number, type: string, config: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(automationSteps).values({ automationId, stepOrder, type: type as any, config });
  const result = await db.select().from(automationSteps).where(eq(automationSteps.automationId, automationId)).orderBy(desc(automationSteps.id)).limit(1);
  return result[0];
}

export async function deleteAutomationStep(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(automationSteps).where(eq(automationSteps.id, id));
}

// ─────────────────────────────────────────────
// Sending domain queries
// ─────────────────────────────────────────────
export async function getSendingDomains(orgId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(sendingDomains).where(eq(sendingDomains.orgId, orgId)).orderBy(desc(sendingDomains.createdAt));
}

export async function getSendingDomainById(orgId: number, id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(sendingDomains).where(and(eq(sendingDomains.id, id), eq(sendingDomains.orgId, orgId))).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createSendingDomain(orgId: number, domain: string, dkimSelector?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(sendingDomains).values({ orgId, domain, dkimSelector: dkimSelector || 'mailflow' });
  const result = await db.select().from(sendingDomains).where(and(eq(sendingDomains.orgId, orgId), eq(sendingDomains.domain, domain))).orderBy(desc(sendingDomains.id)).limit(1);
  return result[0];
}

export async function updateSendingDomain(orgId: number, id: number, data: Partial<typeof sendingDomains.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(sendingDomains).set(data).where(and(eq(sendingDomains.id, id), eq(sendingDomains.orgId, orgId)));
  return getSendingDomainById(orgId, id);
}

export async function deleteSendingDomain(orgId: number, id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(sendingDomains).where(and(eq(sendingDomains.id, id), eq(sendingDomains.orgId, orgId)));
}

// ─────────────────────────────────────────────
// SMTP configuration queries
// ─────────────────────────────────────────────
export async function getSmtpConfigs(orgId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(smtpConfigurations).where(eq(smtpConfigurations.orgId, orgId)).orderBy(desc(smtpConfigurations.createdAt));
}

export async function getSmtpConfigById(orgId: number, id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(smtpConfigurations).where(and(eq(smtpConfigurations.id, id), eq(smtpConfigurations.orgId, orgId))).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getDefaultSmtpConfig(orgId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(smtpConfigurations).where(and(eq(smtpConfigurations.orgId, orgId), eq(smtpConfigurations.isDefault, true), eq(smtpConfigurations.isActive, true))).limit(1);
  if (result.length > 0) return result[0];
  // Fallback to any active config
  const fallback = await db.select().from(smtpConfigurations).where(and(eq(smtpConfigurations.orgId, orgId), eq(smtpConfigurations.isActive, true))).limit(1);
  return fallback.length > 0 ? fallback[0] : undefined;
}

export async function createSmtpConfig(orgId: number, data: Partial<typeof smtpConfigurations.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // If isDefault, unset other defaults
  if (data.isDefault) {
    await db.update(smtpConfigurations).set({ isDefault: false }).where(eq(smtpConfigurations.orgId, orgId));
  }
  await db.insert(smtpConfigurations).values({ orgId, ...data } as any);
  const result = await db.select().from(smtpConfigurations).where(eq(smtpConfigurations.orgId, orgId)).orderBy(desc(smtpConfigurations.id)).limit(1);
  return result[0];
}

export async function updateSmtpConfig(orgId: number, id: number, data: Partial<typeof smtpConfigurations.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (data.isDefault) {
    await db.update(smtpConfigurations).set({ isDefault: false }).where(eq(smtpConfigurations.orgId, orgId));
  }
  await db.update(smtpConfigurations).set(data).where(and(eq(smtpConfigurations.id, id), eq(smtpConfigurations.orgId, orgId)));
  return getSmtpConfigById(orgId, id);
}

export async function deleteSmtpConfig(orgId: number, id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(smtpConfigurations).where(and(eq(smtpConfigurations.id, id), eq(smtpConfigurations.orgId, orgId)));
}

// ─────────────────────────────────────────────
// Dashboard metrics
// ─────────────────────────────────────────────
export async function getDashboardMetrics(orgId: number) {
  const db = await getDb();
  if (!db) return { totalContacts: 0, totalCampaigns: 0, totalSent: 0, avgOpenRate: 0, avgClickRate: 0, totalBounces: 0, totalUnsubscribes: 0 };

  const [contactCount] = await db.select({ count: count() }).from(contacts).where(eq(contacts.orgId, orgId));
  const [campaignCount] = await db.select({ count: count() }).from(campaigns).where(eq(campaigns.orgId, orgId));
  const campaignStats = await db
    .select({
      totalSent: sql<number>`sum(${campaigns.totalSent})`,
      totalDelivered: sql<number>`sum(${campaigns.totalDelivered})`,
      totalOpens: sql<number>`sum(${campaigns.totalOpens})`,
      totalUniqueOpens: sql<number>`sum(${campaigns.totalUniqueOpens})`,
      totalClicks: sql<number>`sum(${campaigns.totalClicks})`,
      totalUniqueClicks: sql<number>`sum(${campaigns.totalUniqueClicks})`,
      totalBounces: sql<number>`sum(${campaigns.totalBounces})`,
      totalUnsubscribes: sql<number>`sum(${campaigns.totalUnsubscribes})`,
    })
    .from(campaigns)
    .where(eq(campaigns.orgId, orgId));

  const stats = campaignStats[0];
  const totalSent = Number(stats?.totalSent ?? 0);
  const totalDelivered = Number(stats?.totalDelivered ?? 0);
  const totalUniqueOpens = Number(stats?.totalUniqueOpens ?? 0);
  const totalUniqueClicks = Number(stats?.totalUniqueClicks ?? 0);

  return {
    totalContacts: contactCount?.count ?? 0,
    totalCampaigns: campaignCount?.count ?? 0,
    totalSent,
    avgOpenRate: totalSent > 0 ? (totalUniqueOpens / totalSent) * 100 : 0,
    avgClickRate: totalSent > 0 ? (totalUniqueClicks / totalSent) * 100 : 0,
    totalBounces: Number(stats?.totalBounces ?? 0),
    totalUnsubscribes: Number(stats?.totalUnsubscribes ?? 0),
  };
}

export async function getRecentCampaigns(orgId: number, limit = 5) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(campaigns).where(eq(campaigns.orgId, orgId)).orderBy(desc(campaigns.createdAt)).limit(limit);
}
