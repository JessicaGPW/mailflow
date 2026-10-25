import { afterEach, describe, expect, it, vi } from "vitest";

const {
  createLocalUserAccount,
  getUserByEmail,
  getUserById,
  updateUserLastSignedIn,
} = vi.hoisted(() => ({
  createLocalUserAccount: vi.fn(),
  getUserByEmail: vi.fn(),
  getUserById: vi.fn(),
  updateUserLastSignedIn: vi.fn(),
}));

vi.mock("./db", () => ({
  createLocalUserAccount,
  getUserByEmail,
  getUserById,
  updateUserLastSignedIn,
}));

import { appRouter } from "./routers";
import { createContext, type TrpcContext } from "./_core/context";
import { createSessionToken, hashPassword } from "./_core/localAuth";
import { COOKIE_NAME } from "@shared/const";

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

function createTestContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "http", headers: {} } as TrpcContext["req"],
    res: {
      cookie: vi.fn(),
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe("local auth procedures", () => {
  it("registers a user, stores a password hash and issues an HTTP-only session cookie", async () => {
    vi.stubEnv("JWT_SECRET", "local-test-secret-with-more-than-32-characters");
    getUserByEmail.mockResolvedValue(undefined);
    createLocalUserAccount.mockImplementation(
      async (input: { passwordHash: string }) => ({
        id: 9,
        passwordHash: input.passwordHash,
      })
    );
    const ctx = createTestContext();

    const result = await appRouter.createCaller(ctx).auth.register({
      name: "Ana User",
      email: "ANA@example.com",
      password: "a sufficiently long password",
    });

    expect(result).toEqual({ success: true });
    expect(createLocalUserAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "ana@example.com",
        name: "Ana User",
        passwordHash: expect.stringMatching(/^scrypt\$/),
      })
    );
    expect(ctx.res.cookie).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.objectContaining({
        httpOnly: true,
        sameSite: "lax",
        secure: false,
      })
    );
  });

  it("rejects duplicate email registration", async () => {
    getUserByEmail.mockResolvedValue({ id: 1 });

    await expect(
      appRouter.createCaller(createTestContext()).auth.register({
        name: "Ana User",
        email: "ana@example.com",
        password: "a sufficiently long password",
      })
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(createLocalUserAccount).not.toHaveBeenCalled();
  });

  it("signs in with the correct password and updates the last sign-in time", async () => {
    vi.stubEnv("JWT_SECRET", "local-test-secret-with-more-than-32-characters");
    getUserByEmail.mockResolvedValue({
      id: 12,
      passwordHash: await hashPassword("a sufficiently long password"),
    });
    const ctx = createTestContext();

    await expect(
      appRouter.createCaller(ctx).auth.login({
        email: "user@example.com",
        password: "a sufficiently long password",
      })
    ).resolves.toEqual({ success: true });

    expect(updateUserLastSignedIn).toHaveBeenCalledWith(12);
    expect(ctx.res.cookie).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.objectContaining({ httpOnly: true })
    );
  });

  it("rejects an incorrect password without issuing a session", async () => {
    vi.stubEnv("JWT_SECRET", "local-test-secret-with-more-than-32-characters");
    getUserByEmail.mockResolvedValue({
      id: 12,
      passwordHash: await hashPassword("a sufficiently long password"),
    });
    const ctx = createTestContext();

    await expect(
      appRouter.createCaller(ctx).auth.login({
        email: "user@example.com",
        password: "a different password",
      })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(ctx.res.cookie).not.toHaveBeenCalled();
  });

  it("does not expose stored password hashes in the authenticated context", async () => {
    vi.stubEnv("JWT_SECRET", "local-test-secret-with-more-than-32-characters");
    const token = await createSessionToken(21);
    getUserById.mockResolvedValue({
      id: 21,
      name: "Test User",
      email: "test@example.com",
      passwordHash: "scrypt$stored-hash",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    });
    const req = {
      protocol: "http",
      headers: { cookie: `${COOKIE_NAME}=${token}` },
    } as TrpcContext["req"];

    const context = await createContext({
      req,
      res: {} as TrpcContext["res"],
    } as Parameters<typeof createContext>[0]);

    expect(context.user?.id).toBe(21);
    expect(context.user?.passwordHash).toBeNull();
  });
});
