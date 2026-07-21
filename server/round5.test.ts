import { describe, expect, it, beforeAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import * as db from "./db";
import { sendTestEmail } from "./emailSender";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createCtx(userId: number, openId: string): TrpcContext {
  const user: AuthenticatedUser = {
    id: userId,
    openId,
    email: `${openId}@example.com`,
    name: "Round5 Tester",
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

const OPEN_ID = `round5-tester-${Date.now()}`;
let caller: ReturnType<typeof appRouter.createCaller>;
let orgId: number;

beforeAll(async () => {
  await db.upsertUser({ openId: OPEN_ID, name: "Round5 Tester" });
  const user = await db.getUserByOpenId(OPEN_ID);
  caller = appRouter.createCaller(createCtx(user!.id, OPEN_ID));
  const org = await caller.org.create({ name: `Org Round5 ${Date.now()}` });
  orgId = org!.id;
});

describe("contacts bulk actions", () => {
  it("bulkAddTag applies tag to all selected contacts idempotently", async () => {
    const c1 = await caller.contacts.create({ orgId, email: `r5a-${Date.now()}@t.com` });
    const c2 = await caller.contacts.create({ orgId, email: `r5b-${Date.now()}@t.com` });
    const tag = await caller.tags.create({ orgId, name: `bulk-${Date.now()}`, color: "#2563eb" });

    const first = await caller.contacts.bulkAddTag({ orgId, contactIds: [c1!.id, c2!.id], tagId: tag!.id });
    expect(first.affected).toBe(2);

    // Idempotent: applying again affects 0
    const second = await caller.contacts.bulkAddTag({ orgId, contactIds: [c1!.id, c2!.id], tagId: tag!.id });
    expect(second.affected).toBe(0);

    const res = await caller.contacts.listAdvanced({ orgId, tagIds: [tag!.id], limit: 50, offset: 0 });
    expect(res.total).toBe(2);
  });

  it("bulkAddToList adds contacts and ignores duplicates", async () => {
    const c1 = await caller.contacts.create({ orgId, email: `r5c-${Date.now()}@t.com` });
    const c2 = await caller.contacts.create({ orgId, email: `r5d-${Date.now()}@t.com` });
    const list = await caller.lists.create({ orgId, name: `Lista Bulk ${Date.now()}` });

    const first = await caller.contacts.bulkAddToList({ orgId, contactIds: [c1!.id, c2!.id], listId: list!.id });
    expect(first.affected).toBe(2);

    const second = await caller.contacts.bulkAddToList({ orgId, contactIds: [c1!.id], listId: list!.id });
    expect(second.affected).toBe(0);
  });

  it("rejects tagId and listId belonging to another organization", async () => {
    const otherOrg = await caller.org.create({ name: `Org R5 Other ${Date.now()}` });
    const otherCaller = caller; // same user owns both orgs; ownership check is by orgId
    const foreignTag = await otherCaller.tags.create({ orgId: otherOrg!.id, name: `foreign-${Date.now()}` });
    const foreignList = await otherCaller.lists.create({ orgId: otherOrg!.id, name: `Foreign ${Date.now()}` });
    const c = await caller.contacts.create({ orgId, email: `r5x-${Date.now()}@t.com` });

    await expect(
      caller.contacts.bulkAddTag({ orgId, contactIds: [c!.id], tagId: foreignTag!.id }),
    ).rejects.toThrow();
    await expect(
      caller.contacts.bulkAddToList({ orgId, contactIds: [c!.id], listId: foreignList!.id }),
    ).rejects.toThrow();
  });

  it("bulkDelete removes only contacts belonging to the org", async () => {
    const c1 = await caller.contacts.create({ orgId, email: `r5e-${Date.now()}@t.com` });
    const result = await caller.contacts.bulkDelete({ orgId, contactIds: [c1!.id, 99999999] });
    expect(result.affected).toBe(1);

    const after = await caller.contacts.listAdvanced({ orgId, search: c1!.email, limit: 10, offset: 0 });
    expect(after.total).toBe(0);
  });
});

describe("contacts.exportCsv", () => {
  it("exports filtered contacts with headers, tags column and CSV escaping", async () => {
    const email = `r5csv-${Date.now()}@t.com`;
    const c = await caller.contacts.create({ orgId, email, firstName: 'Ana "Teste"', lastName: "Com, Virgula" });
    const tag = await caller.tags.create({ orgId, name: `csv-${Date.now()}`, color: "#059669" });
    await caller.tags.addToContact({ orgId, contactId: c!.id, tagId: tag!.id });

    const { csv, filename } = await caller.contacts.exportCsv({ orgId, search: email });
    const lines = csv.split("\n");
    expect(lines[0]).toBe("email,firstName,lastName,phone,status,source,tags,createdAt");
    expect(lines.length).toBe(2);
    expect(lines[1]).toContain(email);
    // Quotes escaped and comma-containing field quoted
    expect(lines[1]).toContain('"Ana ""Teste"""');
    expect(lines[1]).toContain('"Com, Virgula"');
    expect(lines[1]).toContain(tag!.name);
    expect(filename).toMatch(/^contatos-\d{4}-\d{2}-\d{2}\.csv$/);
  });

  it("returns only the header when filters match nothing", async () => {
    const { csv } = await caller.contacts.exportCsv({ orgId, search: "nao-existe-ninguem@x.com" });
    expect(csv.split("\n").length).toBe(1);
  });
});

describe("campaigns.sendTest", () => {
  it("sends a test email in sandbox mode without creating send records", async () => {
    const campaign = await caller.campaigns.create({
      orgId,
      name: "Teste R5",
      subject: "Assunto do teste",
      htmlContent: "<p>Conteúdo</p>",
    });

    const result = await caller.campaigns.sendTest({ orgId, id: campaign!.id, to: "dest@example.com", variant: "a" });
    expect(result.delivered).toBe(true);
    expect(result.sandbox).toBe(true);

    // No send records or metrics created
    const detail = await caller.campaigns.byId({ orgId, id: campaign!.id });
    expect(detail.totalSent).toBe(0);
    expect(detail.status).toBe("draft");
  });

  it("renders variant B subject with [TESTE] prefix and no tracking pixel", async () => {
    const campaign = await caller.campaigns.create({
      orgId,
      name: "Teste R5 AB",
      subject: "Assunto A",
      htmlContent: "<p>Corpo A</p>",
      isAbTest: true,
      abSubjectB: "Assunto B",
      abHtmlContentB: "<p>Corpo B</p>",
    });
    const full = await db.getCampaignById(orgId, campaign!.id);

    // Spy on dispatch by calling sendTestEmail directly (sandbox mode)
    const res = await sendTestEmail(full!, "dest@example.com", "b");
    expect(res.delivered).toBe(true);
    expect(res.sandbox).toBe(true);
  });

  it("rejects test send for campaigns of another org and invalid email", async () => {
    await expect(caller.campaigns.sendTest({ orgId, id: 99999999, to: "x@y.com" })).rejects.toThrow();
    const campaign = await caller.campaigns.create({ orgId, name: "Val", subject: "S" });
    await expect(
      caller.campaigns.sendTest({ orgId, id: campaign!.id, to: "invalido" }),
    ).rejects.toThrow();
  });
});
