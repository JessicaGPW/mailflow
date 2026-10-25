import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createSessionToken,
  hashPassword,
  verifyPassword,
  verifySessionToken,
} from "./_core/localAuth";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("local authentication primitives", () => {
  it("hashes passwords with a random salt and verifies the correct password", async () => {
    const firstHash = await hashPassword("correct horse battery staple");
    const secondHash = await hashPassword("correct horse battery staple");

    expect(firstHash).not.toBe(secondHash);
    expect(
      await verifyPassword("correct horse battery staple", firstHash)
    ).toBe(true);
    expect(await verifyPassword("incorrect password", firstHash)).toBe(false);
  });

  it("rejects missing, malformed and non-password hashes", async () => {
    expect(await verifyPassword("password", null)).toBe(false);
    expect(await verifyPassword("password", "plain-text")).toBe(false);
  });

  it("signs short-lived sessions scoped to a valid local user ID", async () => {
    vi.stubEnv("JWT_SECRET", "local-test-secret-with-more-than-32-characters");
    const token = await createSessionToken(42);

    expect(await verifySessionToken(token)).toBe(42);
    expect(await verifySessionToken(undefined)).toBeNull();
    expect(await verifySessionToken("malformed")).toBeNull();
  });

  it("requires a strong session secret", async () => {
    vi.stubEnv("JWT_SECRET", "too-short");
    await expect(createSessionToken(1)).rejects.toThrow(
      /at least 32 characters/
    );
  });
});
