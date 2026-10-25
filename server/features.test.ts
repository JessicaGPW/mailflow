import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    email: "test@example.com",
    name: "Test User",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

function createAnonContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("ai router", () => {
  it("exposes suggestSubjects and optimizeContent procedures", () => {
    const caller = appRouter.createCaller(createAuthContext());
    expect(caller.ai.suggestSubjects).toBeDefined();
    expect(caller.ai.optimizeContent).toBeDefined();
  });

  it("ai.suggestSubjects requires authentication", async () => {
    const caller = appRouter.createCaller(createAnonContext());
    await expect(
      caller.ai.suggestSubjects({ orgId: 1, topic: "Lançamento de produto" })
    ).rejects.toThrow();
  });

  it("ai.optimizeContent requires authentication", async () => {
    const caller = appRouter.createCaller(createAnonContext());
    await expect(
      caller.ai.optimizeContent({ orgId: 1, content: "Olá mundo", goal: "clarity" })
    ).rejects.toThrow();
  });

  it("ai.suggestSubjects rejects empty topic", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    await expect(
      caller.ai.suggestSubjects({ orgId: 1, topic: "" })
    ).rejects.toThrow();
  });
});

describe("A/B testing", () => {
  it("exposes abResults procedure", () => {
    const caller = appRouter.createCaller(createAuthContext());
    expect(caller.campaigns.abResults).toBeDefined();
  });

  it("campaigns.abResults requires authentication", async () => {
    const caller = appRouter.createCaller(createAnonContext());
    await expect(
      caller.campaigns.abResults({ orgId: 1, campaignId: 1 })
    ).rejects.toThrow();
  });

  it("campaigns.create accepts A/B test fields", async () => {
    // Schema validation: parsing should accept the A/B fields without error.
    // This will fail with NOT_FOUND (no membership), which proves the input
    // passed Zod validation and reached the authorization layer.
    const caller = appRouter.createCaller(createAuthContext());
    await expect(
      caller.campaigns.create({
        orgId: 999999,
        name: "AB Campaign",
        subject: "Subject A",
        isAbTest: true,
        abSubjectB: "Subject B",
        abWinnerCriteria: "open_rate",
      })
    ).rejects.toThrowError(/NOT_FOUND|not found/i);
  });

  it("campaigns.create rejects invalid abWinnerCriteria", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    await expect(
      caller.campaigns.create({
        orgId: 1,
        name: "AB Campaign",
        subject: "Subject A",
        // @ts-expect-error invalid criteria on purpose
        abWinnerCriteria: "invalid_criteria",
      })
    ).rejects.toThrow();
  });
});

describe("email builder compilation (shared logic)", () => {
  // Mirror of client compile logic contract: blocks must serialize to JSON
  it("designJson round-trips through JSON", () => {
    const blocks = [
      { id: "abc123", type: "heading", content: "Título", align: "left" },
      { id: "def456", type: "button", label: "Comprar", url: "https://x.com", bgColor: "#4f46e5", textColor: "#fff", align: "center" },
    ];
    const json = JSON.stringify(blocks);
    const parsed = JSON.parse(json);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].type).toBe("heading");
    expect(parsed[1].url).toBe("https://x.com");
  });
});
