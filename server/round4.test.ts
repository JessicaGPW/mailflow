import { describe, expect, it, beforeAll, afterAll } from "vitest";

// These suites talk to a real MySQL database. Without DATABASE_URL they are
// skipped instead of failing with "Cannot read properties of undefined".
const HAS_DB = Boolean(process.env.DATABASE_URL);
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import * as db from "./db";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createCtx(userId: number, openId: string): TrpcContext {
  const user: AuthenticatedUser = {
    id: userId,
    openId,
    email: `${openId}@example.com`,
    name: "Round4 Tester",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {}, cookie: () => {} } as unknown as TrpcContext["res"],
  };
}

const OPEN_ID = `round4-tester-${Date.now()}`;
let ctx: TrpcContext;
let caller: ReturnType<typeof appRouter.createCaller>;
let orgId: number;

beforeAll(async () => {
  if (!HAS_DB) return;
  await db.upsertUser({ openId: OPEN_ID, name: "Round4 Tester" });
  const user = await db.getUserByOpenId(OPEN_ID);
  ctx = createCtx(user!.id, OPEN_ID);
  caller = appRouter.createCaller(ctx);
  const org = await caller.org.create({ name: `Org Round4 ${Date.now()}` });
  orgId = org!.id;
});

afterAll(async () => {
  if (!HAS_DB) return;
  // Cleanup happens implicitly; test org data is isolated per run
});

describe.skipIf(!HAS_DB)("campaigns.duplicate", () => {
  it("duplicates a campaign copying content, design and A/B settings with draft status", async () => {
    const original = await caller.campaigns.create({
      orgId,
      name: "Original R4",
      subject: "Assunto original",
      preheader: "Prévia",
      fromName: "Remetente",
      fromEmail: "r@example.com",
      htmlContent: "<p>Olá</p>",
      textContent: "Olá",
      designJson: JSON.stringify([{ id: "b1", type: "text", content: "Olá" }]),
      isAbTest: true,
      abSubjectB: "Assunto B",
      abWinnerCriteria: "click_rate",
    });

    const copy = await caller.campaigns.duplicate({ orgId, id: original!.id });

    expect(copy.id).not.toBe(original!.id);
    expect(copy.name).toBe("Original R4 (cópia)");
    expect(copy.subject).toBe("Assunto original");
    expect(copy.htmlContent).toBe("<p>Olá</p>");
    expect(copy.designJson).toBe(JSON.stringify([{ id: "b1", type: "text", content: "Olá" }]));
    expect(copy.isAbTest).toBe(true);
    expect(copy.abSubjectB).toBe("Assunto B");
    expect(copy.abWinnerCriteria).toBe("click_rate");
    expect(copy.status).toBe("draft");
    expect(copy.totalSent).toBe(0);
    expect(copy.sentAt).toBeNull();
  });

  it("rejects duplicating a campaign from another organization", async () => {
    await expect(caller.campaigns.duplicate({ orgId, id: 99999999 })).rejects.toThrow();
  });
});

describe.skipIf(!HAS_DB)("campaigns.comparisonReport", () => {
  it("returns only sent/sending campaigns with computed rates", async () => {
    const report = await caller.campaigns.comparisonReport({ orgId, limit: 20 });
    // Newly created org has no sent campaigns yet — drafts must not appear
    expect(Array.isArray(report)).toBe(true);
    for (const row of report) {
      expect(row).toHaveProperty("openRate");
      expect(row).toHaveProperty("clickRate");
      expect(row).toHaveProperty("bounceRate");
    }
    const draftsIncluded = report.some(r => r.name === "Original R4");
    expect(draftsIncluded).toBe(false);
  });
});

describe.skipIf(!HAS_DB)("contacts.listAdvanced", () => {
  it("filters by tag with AND semantics and returns tags attached", async () => {
    const c1 = await caller.contacts.create({ orgId, email: `r4a-${Date.now()}@t.com`, firstName: "Alfa" });
    const c2 = await caller.contacts.create({ orgId, email: `r4b-${Date.now()}@t.com`, firstName: "Beta" });
    const tagVip = await caller.tags.create({ orgId, name: `vip-${Date.now()}`, color: "#2563eb" });
    const tagNews = await caller.tags.create({ orgId, name: `news-${Date.now()}`, color: "#059669" });

    await caller.tags.addToContact({ orgId, contactId: c1!.id, tagId: tagVip!.id });
    await caller.tags.addToContact({ orgId, contactId: c1!.id, tagId: tagNews!.id });
    await caller.tags.addToContact({ orgId, contactId: c2!.id, tagId: tagVip!.id });

    // Single tag: both contacts
    const oneTag = await caller.contacts.listAdvanced({ orgId, tagIds: [tagVip!.id], limit: 50, offset: 0 });
    const oneTagIds = oneTag.contacts.map(c => c.id);
    expect(oneTagIds).toContain(c1!.id);
    expect(oneTagIds).toContain(c2!.id);

    // Both tags (AND): only c1
    const bothTags = await caller.contacts.listAdvanced({ orgId, tagIds: [tagVip!.id, tagNews!.id], limit: 50, offset: 0 });
    const bothIds = bothTags.contacts.map(c => c.id);
    expect(bothIds).toContain(c1!.id);
    expect(bothIds).not.toContain(c2!.id);

    // Tags attached to page rows
    const c1Row = bothTags.contacts.find(c => c.id === c1!.id);
    expect(c1Row?.tags.length).toBe(2);
  });

  it("filters by status and search combined, returning accurate total", async () => {
    const email = `r4status-${Date.now()}@t.com`;
    const c = await caller.contacts.create({ orgId, email, firstName: "Gama" });
    await caller.contacts.update({ orgId, id: c!.id, status: "unsubscribed" });

    const res = await caller.contacts.listAdvanced({ orgId, status: "unsubscribed", search: email, limit: 50, offset: 0 });
    expect(res.total).toBe(1);
    expect(res.contacts[0]?.email).toBe(email);

    const none = await caller.contacts.listAdvanced({ orgId, status: "bounced", search: email, limit: 50, offset: 0 });
    expect(none.total).toBe(0);
  });

  it("filters by engagement=no_engagement including contacts without events", async () => {
    const email = `r4eng-${Date.now()}@t.com`;
    const c = await caller.contacts.create({ orgId, email });
    const res = await caller.contacts.listAdvanced({ orgId, engagement: "no_engagement", search: email, limit: 50, offset: 0 });
    expect(res.contacts.map(x => x.id)).toContain(c!.id);
  });
});
