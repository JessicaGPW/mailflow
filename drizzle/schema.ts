import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  json,
  boolean,
  datetime,
  longtext,
} from "drizzle-orm/mysql-core";

// ─────────────────────────────────────────────
// Core user table (from template, extended)
// ─────────────────────────────────────────────
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─────────────────────────────────────────────
// Organizations (multi-tenant)
// ─────────────────────────────────────────────
export const organizations = mysqlTable("organizations", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  ownerId: int("ownerId").notNull(),
  plan: mysqlEnum("plan", ["free", "starter", "pro", "enterprise"]).default("free").notNull(),
  defaultFromName: varchar("defaultFromName", { length: 255 }),
  defaultFromEmail: varchar("defaultFromEmail", { length: 320 }),
  defaultReplyTo: varchar("defaultReplyTo", { length: 320 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Organization = typeof organizations.$inferSelect;
export type InsertOrganization = typeof organizations.$inferInsert;

// ─────────────────────────────────────────────
// Organization members (multi-user per org)
// ─────────────────────────────────────────────
export const organizationMembers = mysqlTable("organization_members", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").notNull(),
  userId: int("userId").notNull(),
  role: mysqlEnum("role", ["admin", "member"]).default("member").notNull(),
  invitedEmail: varchar("invitedEmail", { length: 320 }),
  status: mysqlEnum("status", ["active", "invited", "removed"]).default("invited").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type OrganizationMember = typeof organizationMembers.$inferSelect;
export type InsertOrganizationMember = typeof organizationMembers.$inferInsert;

// ─────────────────────────────────────────────
// Contacts
// ─────────────────────────────────────────────
export const contacts = mysqlTable("contacts", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  firstName: varchar("firstName", { length: 255 }),
  lastName: varchar("lastName", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  status: mysqlEnum("status", ["subscribed", "unsubscribed", "bounced", "complained"]).default("subscribed").notNull(),
  source: mysqlEnum("source", ["import", "manual", "api", "form"]).default("manual").notNull(),
  ipAddress: varchar("ipAddress", { length: 45 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Contact = typeof contacts.$inferSelect;
export type InsertContact = typeof contacts.$inferInsert;

// ─────────────────────────────────────────────
// Contact Lists
// ─────────────────────────────────────────────
export const contactLists = mysqlTable("contact_lists", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ContactList = typeof contactLists.$inferSelect;
export type InsertContactList = typeof contactLists.$inferInsert;

// ─────────────────────────────────────────────
// Contact-List memberships (many-to-many)
// ─────────────────────────────────────────────
export const contactListMemberships = mysqlTable("contact_list_memberships", {
  id: int("id").autoincrement().primaryKey(),
  contactId: int("contactId").notNull(),
  listId: int("listId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ContactListMembership = typeof contactListMemberships.$inferSelect;
export type InsertContactListMembership = typeof contactListMemberships.$inferInsert;

// ─────────────────────────────────────────────
// Contact Tags
// ─────────────────────────────────────────────
export const contactTags = mysqlTable("contact_tags", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  color: varchar("color", { length: 7 }).default("#6366f1"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ContactTag = typeof contactTags.$inferSelect;
export type InsertContactTag = typeof contactTags.$inferInsert;

// ─────────────────────────────────────────────
// Contact-Tag associations
// ─────────────────────────────────────────────
export const contactTagAssociations = mysqlTable("contact_tag_associations", {
  id: int("id").autoincrement().primaryKey(),
  contactId: int("contactId").notNull(),
  tagId: int("tagId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ContactTagAssociation = typeof contactTagAssociations.$inferSelect;

// ─────────────────────────────────────────────
// Custom field definitions
// ─────────────────────────────────────────────
export const customFields = mysqlTable("custom_fields", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  key: varchar("key", { length: 100 }).notNull(),
  type: mysqlEnum("type", ["text", "number", "date", "boolean", "select"]).default("text").notNull(),
  options: text("options"), // JSON array for select type
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CustomField = typeof customFields.$inferSelect;
export type InsertCustomField = typeof customFields.$inferInsert;

// ─────────────────────────────────────────────
// Custom field values
// ─────────────────────────────────────────────
export const customFieldValues = mysqlTable("custom_field_values", {
  id: int("id").autoincrement().primaryKey(),
  contactId: int("contactId").notNull(),
  fieldId: int("fieldId").notNull(),
  value: text("value"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CustomFieldValue = typeof customFieldValues.$inferSelect;

// ─────────────────────────────────────────────
// Segments (dynamic)
// ─────────────────────────────────────────────
export const segments = mysqlTable("segments", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  rules: longtext("rules").notNull(), // JSON: array of rule groups
  matchType: mysqlEnum("matchType", ["all", "any"]).default("all").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Segment = typeof segments.$inferSelect;
export type InsertSegment = typeof segments.$inferInsert;

// ─────────────────────────────────────────────
// Email Templates
// ─────────────────────────────────────────────
export const emailTemplates = mysqlTable("email_templates", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  subject: varchar("subject", { length: 500 }),
  preheader: varchar("preheader", { length: 500 }),
  htmlContent: longtext("htmlContent"),
  textContent: longtext("textContent"),
  thumbnailUrl: varchar("thumbnailUrl", { length: 500 }),
  category: varchar("category", { length: 100 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type EmailTemplate = typeof emailTemplates.$inferSelect;
export type InsertEmailTemplate = typeof emailTemplates.$inferInsert;

// ─────────────────────────────────────────────
// Campaigns
// ─────────────────────────────────────────────
export const campaigns = mysqlTable("campaigns", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  subject: varchar("subject", { length: 500 }).notNull(),
  preheader: varchar("preheader", { length: 500 }),
  fromName: varchar("fromName", { length: 255 }),
  fromEmail: varchar("fromEmail", { length: 320 }),
  replyTo: varchar("replyTo", { length: 320 }),
  htmlContent: longtext("htmlContent"),
  textContent: longtext("textContent"),
  designJson: longtext("designJson"),
  targetListId: int("targetListId"),
  targetSegmentId: int("targetSegmentId"),
  status: mysqlEnum("status", ["draft", "scheduled", "sending", "sent", "paused", "failed"]).default("draft").notNull(),
  scheduledAt: datetime("scheduledAt"),
  sentAt: datetime("sentAt"),
  totalRecipients: int("totalRecipients").default(0).notNull(),
  totalSent: int("totalSent").default(0).notNull(),
  totalDelivered: int("totalDelivered").default(0).notNull(),
  totalOpens: int("totalOpens").default(0).notNull(),
  totalUniqueOpens: int("totalUniqueOpens").default(0).notNull(),
  totalClicks: int("totalClicks").default(0).notNull(),
  totalUniqueClicks: int("totalUniqueClicks").default(0).notNull(),
  totalBounces: int("totalBounces").default(0).notNull(),
  totalUnsubscribes: int("totalUnsubscribes").default(0).notNull(),
  totalComplaints: int("totalComplaints").default(0).notNull(),
  // A/B Testing
  isAbTest: boolean("isAbTest").default(false).notNull(),
  abSubjectB: varchar("abSubjectB", { length: 500 }),
  abHtmlContentB: longtext("abHtmlContentB"),
  abWinnerCriteria: mysqlEnum("abWinnerCriteria", ["open_rate", "click_rate"]).default("open_rate"),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Campaign = typeof campaigns.$inferSelect;
export type InsertCampaign = typeof campaigns.$inferInsert;

// ─────────────────────────────────────────────
// Campaign sends (individual email records)
// ─────────────────────────────────────────────
export const campaignSends = mysqlTable("campaign_sends", {
  id: int("id").autoincrement().primaryKey(),
  campaignId: int("campaignId").notNull(),
  contactId: int("contactId").notNull(),
  status: mysqlEnum("status", ["pending", "sent", "delivered", "bounced", "failed"]).default("pending").notNull(),
  variant: mysqlEnum("variant", ["a", "b"]).default("a").notNull(),
  recipientEmail: varchar("recipientEmail", { length: 320 }).notNull(),
  message_id: varchar("messageId", { length: 255 }),
  error: text("error"),
  sentAt: datetime("sentAt"),
  deliveredAt: datetime("deliveredAt"),
  bouncedAt: datetime("bouncedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CampaignSend = typeof campaignSends.$inferSelect;
export type InsertCampaignSend = typeof campaignSends.$inferInsert;

// ─────────────────────────────────────────────
// Email links (tracked links in campaigns)
// ─────────────────────────────────────────────
export const emailLinks = mysqlTable("email_links", {
  id: int("id").autoincrement().primaryKey(),
  campaignId: int("campaignId").notNull(),
  url: varchar("url", { length: 2048 }).notNull(),
  shortId: varchar("shortId", { length: 32 }).notNull().unique(),
  totalClicks: int("totalClicks").default(0).notNull(),
  uniqueClicks: int("uniqueClicks").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type EmailLink = typeof emailLinks.$inferSelect;

// ─────────────────────────────────────────────
// Email events (opens, clicks, bounces, unsubscribes)
// ─────────────────────────────────────────────
export const emailEvents = mysqlTable("email_events", {
  id: int("id").autoincrement().primaryKey(),
  campaignId: int("campaignId"),
  sendId: int("sendId"),
  contactId: int("contactId"),
  type: mysqlEnum("type", ["open", "click", "bounce", "unsubscribe", "complain", "delivered"]).notNull(),
  url: varchar("url", { length: 2048 }),
  userAgent: text("userAgent"),
  ipAddress: varchar("ipAddress", { length: 45 }),
  bounceReason: text("bounceReason"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type EmailEvent = typeof emailEvents.$inferSelect;
export type InsertEmailEvent = typeof emailEvents.$inferInsert;

// ─────────────────────────────────────────────
// Automations
// ─────────────────────────────────────────────
export const automations = mysqlTable("automations", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  triggerType: mysqlEnum("triggerType", ["list_subscription", "email_open", "link_click", "specific_date"]).notNull(),
  triggerConfig: longtext("triggerConfig").notNull(), // JSON: trigger params
  status: mysqlEnum("status", ["active", "paused", "draft"]).default("draft").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Automation = typeof automations.$inferSelect;
export type InsertAutomation = typeof automations.$inferInsert;

// ─────────────────────────────────────────────
// Automation steps (email actions in a flow)
// ─────────────────────────────────────────────
export const automationSteps = mysqlTable("automation_steps", {
  id: int("id").autoincrement().primaryKey(),
  automationId: int("automationId").notNull(),
  stepOrder: int("stepOrder").notNull(),
  type: mysqlEnum("type", ["send_email", "wait", "condition", "add_tag", "remove_tag", "move_to_list"]).notNull(),
  config: longtext("config").notNull(), // JSON: step params
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AutomationStep = typeof automationSteps.$inferSelect;
export type InsertAutomationStep = typeof automationSteps.$inferInsert;

// ─────────────────────────────────────────────
// Automation enrollments
// ─────────────────────────────────────────────
export const automationEnrollments = mysqlTable("automation_enrollments", {
  id: int("id").autoincrement().primaryKey(),
  automationId: int("automationId").notNull(),
  contactId: int("contactId").notNull(),
  currentStep: int("currentStep").default(0).notNull(),
  status: mysqlEnum("status", ["active", "completed", "exited"]).default("active").notNull(),
  enrolledAt: timestamp("enrolledAt").defaultNow().notNull(),
  completedAt: datetime("completedAt"),
  nextStepAt: datetime("nextStepAt"),
});

export type AutomationEnrollment = typeof automationEnrollments.$inferSelect;

// ─────────────────────────────────────────────
// Sending domains (custom domains per org)
// ─────────────────────────────────────────────
export const sendingDomains = mysqlTable("sending_domains", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").notNull(),
  domain: varchar("domain", { length: 255 }).notNull(),
  verificationStatus: mysqlEnum("verificationStatus", ["pending", "verified", "failed"]).default("pending").notNull(),
  dkimStatus: mysqlEnum("dkimStatus", ["pending", "verified", "failed"]).default("pending").notNull(),
  spfStatus: mysqlEnum("spfStatus", ["pending", "verified", "failed"]).default("pending").notNull(),
  dmarcStatus: mysqlEnum("dmarcStatus", ["pending", "verified", "failed"]).default("pending").notNull(),
  dkimPublicKey: text("dkimPublicKey"),
  dkimSelector: varchar("dkimSelector", { length: 100 }).default("mailflow"),
  isDefault: boolean("isDefault").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SendingDomain = typeof sendingDomains.$inferSelect;
export type InsertSendingDomain = typeof sendingDomains.$inferInsert;

// ─────────────────────────────────────────────
// SMTP configurations (per org)
// ─────────────────────────────────────────────
export const smtpConfigurations = mysqlTable("smtp_configurations", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").notNull(),
  provider: mysqlEnum("provider", ["sendgrid", "mailgun", "ses", "smtp", "mailflow"]).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  apiKey: text("apiKey"), // encrypted in practice
  smtpHost: varchar("smtpHost", { length: 255 }),
  smtpPort: int("smtpPort"),
  smtpUsername: varchar("smtpUsername", { length: 255 }),
  smtpPassword: text("smtpPassword"),
  fromEmail: varchar("fromEmail", { length: 320 }),
  fromName: varchar("fromName", { length: 255 }),
  replyTo: varchar("replyTo", { length: 320 }),
  isDefault: boolean("isDefault").default(false).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SmtpConfiguration = typeof smtpConfigurations.$inferSelect;
export type InsertSmtpConfiguration = typeof smtpConfigurations.$inferInsert;
