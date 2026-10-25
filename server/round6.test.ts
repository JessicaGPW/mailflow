import { describe, expect, it, beforeAll } from "vitest";

// These suites talk to a real MySQL database. Without DATABASE_URL they are
// skipped instead of failing with "Cannot read properties of undefined".
const HAS_DB = Boolean(process.env.DATABASE_URL);
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import * as db from "./db";
import { parseCsv, guessMapping } from "../client/src/components/CsvImportWizard";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createCtx(userId: number, email: string): TrpcContext {
  const user: AuthenticatedUser = {
    id: userId,
    email,
    name: "Round6 Tester",
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

const TEST_EMAIL = `round6-tester-${Date.now()}@example.com`;
let caller: ReturnType<typeof appRouter.createCaller>;
let orgId: number;

beforeAll(async () => {
  if (!HAS_DB) return;
  await db.upsertUser({ email: TEST_EMAIL, name: "Round6 Tester" });
  const user = await db.getUserByEmail(TEST_EMAIL);
  caller = appRouter.createCaller(createCtx(user!.id, TEST_EMAIL));
  const org = await caller.org.create({ name: `Org Round6 ${Date.now()}` });
  orgId = org!.id;
});

describe.skipIf(!HAS_DB)("contacts.profile", () => {
  it("returns the full 360º profile with tags, lists and empty engagement", async () => {
    const contact = await caller.contacts.create({
      orgId, email: `r6p-${Date.now()}@t.com`, firstName: "Ana", lastName: "Prof",
    });
    const tag = await caller.tags.create({ orgId, name: `perfil-${Date.now()}`, color: "#7c3aed" });
    await caller.tags.addToContact({ orgId, contactId: contact!.id, tagId: tag!.id });
    const list = await caller.lists.create({ orgId, name: `Lista Perfil ${Date.now()}` });
    await caller.lists.addContact({ orgId, listId: list!.id, contactId: contact!.id });

    const profile = await caller.contacts.profile({ orgId, id: contact!.id });
    expect(profile.contact.email).toBe(contact!.email);
    expect(profile.tags.map(t => t.name)).toContain(tag!.name);
    expect(profile.lists.map(l => l.name)).toContain(list!.name);
    expect(profile.summary).toEqual({ totalReceived: 0, opens: 0, clicks: 0 });
    expect(profile.events).toEqual([]);
    expect(profile.sends).toEqual([]);
  });

  it("rejects a contact id that does not belong to the org", async () => {
    await expect(caller.contacts.profile({ orgId, id: 99999999 })).rejects.toThrow();
  });
});

describe.skipIf(!HAS_DB)("campaigns.schedule / unschedule validations", () => {
  it("rejects scheduling in the past", async () => {
    const campaign = await caller.campaigns.create({
      orgId, name: "Agendada R6", subject: "Assunto", htmlContent: "<p>Oi</p>",
    });
    await expect(
      caller.campaigns.schedule({ orgId, id: campaign!.id, scheduledAt: new Date(Date.now() - 3600_000) }),
    ).rejects.toThrow(/futuro/);
  });

  it("rejects scheduling an A/B campaign without variant B subject", async () => {
    const campaign = await caller.campaigns.create({
      orgId, name: "AB sem B", subject: "A", htmlContent: "<p>A</p>", isAbTest: true,
    });
    await expect(
      caller.campaigns.schedule({ orgId, id: campaign!.id, scheduledAt: new Date(Date.now() + 3600_000) }),
    ).rejects.toThrow(/variante B/);
  });

  it("rejects unschedule of a campaign that is not scheduled", async () => {
    const campaign = await caller.campaigns.create({
      orgId, name: "Draft R6", subject: "S", htmlContent: "<p>x</p>",
    });
    await expect(caller.campaigns.unschedule({ orgId, id: campaign!.id })).rejects.toThrow(/agendada/);
  });

  it("rejects scheduling a campaign from another org", async () => {
    await expect(
      caller.campaigns.schedule({ orgId, id: 99999999, scheduledAt: new Date(Date.now() + 3600_000) }),
    ).rejects.toThrow();
  });

});

describe("CSV parser and column mapping", () => {
  it("parses quoted fields, escaped quotes and embedded commas", () => {
    const rows = parseCsv('email,nome\n"a@b.com","Silva, João"\n"c@d.com","Ana ""Bia"""');
    expect(rows).toEqual([
      ["email", "nome"],
      ["a@b.com", "Silva, João"],
      ["c@d.com", 'Ana "Bia"'],
    ]);
  });

  it("sniffs semicolon delimiter and skips blank lines", () => {
    const rows = parseCsv("email;nome\n\na@b.com;Ana\n");
    expect(rows).toEqual([["email", "nome"], ["a@b.com", "Ana"]]);
  });

  it("guesses column mapping from pt and en headers", () => {
    expect(guessMapping(["E-mail", "Nome", "Sobrenome", "Telefone"]))
      .toEqual({ email: 0, firstName: 1, lastName: 2, phone: 3 });
    expect(guessMapping(["first_name", "last_name", "email", "mobile"]))
      .toEqual({ email: 2, firstName: 0, lastName: 1, phone: 3 });
  });

  it("returns null for columns that are absent", () => {
    const m = guessMapping(["email", "cidade"]);
    expect(m.email).toBe(0);
    expect(m.lastName).toBeNull();
    expect(m.phone).toBeNull();
  });
});
