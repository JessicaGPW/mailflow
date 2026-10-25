import { describe, expect, it, vi, beforeEach } from "vitest";
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

describe("appRouter structure", () => {
  it("exposes all expected top-level routers", () => {
    const caller = appRouter.createCaller(createAuthContext());
    expect(caller.auth).toBeDefined();
    expect(caller.org).toBeDefined();
    expect(caller.contacts).toBeDefined();
    expect(caller.lists).toBeDefined();
    expect(caller.tags).toBeDefined();
    expect(caller.customFields).toBeDefined();
    expect(caller.segments).toBeDefined();
    expect(caller.templates).toBeDefined();
    expect(caller.campaigns).toBeDefined();
    expect(caller.automations).toBeDefined();
    expect(caller.sendingDomains).toBeDefined();
    expect(caller.smtp).toBeDefined();
    expect(caller.dashboard).toBeDefined();
  });

  it("auth.me returns the current user", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).not.toBeNull();
    expect(result?.email).toBe("test@example.com");
  });

  it("auth.logout clears session cookie and returns success", async () => {
    const clearedCookies: Array<{ name: string; options: Record<string, unknown> }> = [];
    const ctx = createAuthContext();
    ctx.res = {
      clearCookie: (name: string, options: Record<string, unknown>) => {
        clearedCookies.push({ name, options });
      },
    } as TrpcContext["res"];

    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();

    expect(result).toEqual({ success: true });
    expect(clearedCookies).toHaveLength(1);
    expect(clearedCookies[0]?.options).toMatchObject({ maxAge: -1 });
  });
});

describe("organization procedures", () => {
  it("org.list requires authentication", async () => {
    const ctx: TrpcContext = {
      user: null,
      req: {} as TrpcContext["req"],
      res: {} as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);
    await expect(caller.org.list()).rejects.toThrow();
  });
});

describe("campaign procedures", () => {
  it("campaigns.list requires authentication", async () => {
    const ctx: TrpcContext = {
      user: null,
      req: {} as TrpcContext["req"],
      res: {} as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);
    await expect(caller.campaigns.list({ orgId: 1 })).rejects.toThrow();
  });
});

describe("contact procedures", () => {
  it("contacts.list requires authentication", async () => {
    const ctx: TrpcContext = {
      user: null,
      req: {} as TrpcContext["req"],
      res: {} as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);
    await expect(caller.contacts.list({ orgId: 1 })).rejects.toThrow();
  });
});
