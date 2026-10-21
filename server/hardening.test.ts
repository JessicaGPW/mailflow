import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import * as db from "./db";
import { smtpConfigurations } from "../drizzle/schema";
import { isEncrypted } from "./security";

// Integration tests for the security/sending fixes. Need a real MySQL:
// DATABASE_URL=mysql://... pnpm test
const HAS_DB = Boolean(process.env.DATABASE_URL);

function createCtx(userId: number, openId: string): TrpcContext {
  return {
    user: {
      id: userId,
      openId,
      email: `${openId}@example.com`,
      name: openId,
      loginMethod: "test",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {}, cookie: () => {} } as unknown as TrpcContext["res"],
  };
}

async function makeUser(prefix: string) {
  const openId = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  await db.upsertUser({ openId, name: prefix });
  const user = await db.getUserByOpenId(openId);
  return { user: user!, caller: appRouter.createCaller(createCtx(user!.id, openId)) };
}

let admin: Awaited<ReturnType<typeof makeUser>>;
let member: Awaited<ReturnType<typeof makeUser>>;
let orgA: number;
let orgB: number;

beforeAll(async () => {
  if (!HAS_DB) return;
  admin = await makeUser("hardening-admin");
  member = await makeUser("hardening-member");
  orgA = (await admin.caller.org.create({ name: `Org A ${Date.now()}` }))!.id;
  orgB = (await admin.caller.org.create({ name: `Org B ${Date.now()}` }))!.id;
  await db.addOrgMember(orgA, member.user.id, "member");
});

describe.skipIf(!HAS_DB)("campaign sending", () => {
  it("cannot be sent twice (atomic claim)", async () => {
    await admin.caller.contacts.create({ orgId: orgA, email: `once-${Date.now()}@t.com` });
    const campaign = await admin.caller.campaigns.create({ orgId: orgA, name: "Once", subject: "Hi", htmlContent: "<p>hi</p>" });

    const results = await Promise.allSettled([
      admin.caller.campaigns.send({ orgId: orgA, id: campaign!.id }),
      admin.caller.campaigns.send({ orgId: orgA, id: campaign!.id }),
    ]);
    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find(r => r.status === "rejected") as PromiseRejectedResult;
    expect(rejected.reason.code).toBe("CONFLICT");

    await expect(admin.caller.campaigns.send({ orgId: orgA, id: campaign!.id })).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("is restricted to org admins", async () => {
    const campaign = await member.caller.campaigns.create({ orgId: orgA, name: "Member draft", subject: "Hi" });
    await expect(member.caller.campaigns.send({ orgId: orgA, id: campaign!.id })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(member.caller.campaigns.delete({ orgId: orgA, id: campaign!.id })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe.skipIf(!HAS_DB)("unsubscribe scoping", () => {
  it("only changes contacts of the campaign's own organization", async () => {
    const victim = await admin.caller.contacts.create({ orgId: orgB, email: `victim-${Date.now()}@t.com` });
    const campaignA = await admin.caller.campaigns.create({ orgId: orgA, name: "A", subject: "A" });

    await db.recordUnsubscribeEvent(campaignA!.id, null, victim!.id);

    const after = await db.getContactById(orgB, victim!.id);
    expect(after!.status).toBe("subscribed");
  });

  it("is idempotent for the same contact", async () => {
    const contact = await admin.caller.contacts.create({ orgId: orgA, email: `idem-${Date.now()}@t.com` });
    const campaign = await admin.caller.campaigns.create({ orgId: orgA, name: "Idem", subject: "Idem" });
    await db.recordUnsubscribeEvent(campaign!.id, null, contact!.id);
    await db.recordUnsubscribeEvent(campaign!.id, null, contact!.id);
    const updated = await db.getCampaignById(orgA, campaign!.id);
    expect(updated!.totalUnsubscribes).toBe(1);
    expect((await db.getContactById(orgA, contact!.id))!.status).toBe("unsubscribed");
  });
});

describe.skipIf(!HAS_DB)("SMTP credentials", () => {
  it("are encrypted at rest, masked in the API and decrypted only for sending", async () => {
    const created = await admin.caller.smtp.create({ orgId: orgA, name: "SG", provider: "sendgrid", apiKey: "SG.plain-key", isDefault: true });

    const conn = await db.getDb();
    const [row] = await conn!.select().from(smtpConfigurations).where(eq(smtpConfigurations.id, created!.id));
    expect(isEncrypted(row.apiKey)).toBe(true);
    expect(row.apiKey).not.toContain("plain-key");

    const listed = await admin.caller.smtp.list({ orgId: orgA });
    expect(listed.find(c => c.id === created!.id)!.apiKey).toBe("••••••••");

    const forSending = await db.getDefaultSmtpConfig(orgA);
    expect(forSending!.apiKey).toBe("SG.plain-key");
  });

  it("can only be managed by admins", async () => {
    await expect(member.caller.smtp.create({ orgId: orgA, name: "x", provider: "sendgrid" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
