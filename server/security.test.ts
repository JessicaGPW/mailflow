import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import type { AddressInfo } from "node:net";

vi.mock("./db", () => ({
  getOrCreateEmailLink: vi.fn(async (campaignId: number, url: string) => ({ id: 1, campaignId, url, shortId: "abc123" })),
  getEmailLinkByShortId: vi.fn(),
  incrementLinkClicks: vi.fn(),
  recordOpenEvent: vi.fn(),
  recordClickEvent: vi.fn(),
  recordUnsubscribeEvent: vi.fn(),
}));

import * as db from "./db";
import {
  decryptSecret,
  encryptSecret,
  isEncrypted,
  shuffle,
  signTrackingToken,
  verifyTrackingToken,
} from "./security";
import { injectTracking } from "./emailSender";
import { dispatchEmail } from "./email/providers";
import { registerTrackingRoutes } from "./_core/tracking";

describe("tracking tokens", () => {
  it("verifies a token only for the same purpose, campaign and contact", () => {
    const token = signTrackingToken("unsubscribe", 10, 42);
    expect(verifyTrackingToken("unsubscribe", 10, 42, token)).toBe(true);
    expect(verifyTrackingToken("unsubscribe", 10, 43, token)).toBe(false); // other contact
    expect(verifyTrackingToken("unsubscribe", 11, 42, token)).toBe(false); // other campaign
    expect(verifyTrackingToken("open", 10, 42, token)).toBe(false); // other purpose
  });

  it("rejects missing or malformed tokens", () => {
    expect(verifyTrackingToken("open", 1, 1, undefined)).toBe(false);
    expect(verifyTrackingToken("open", 1, 1, "")).toBe(false);
    expect(verifyTrackingToken("open", 1, 1, ["a"])).toBe(false);
    expect(verifyTrackingToken("open", Number.NaN, 1, "x")).toBe(false);
  });
});

describe("secrets at rest", () => {
  it("round-trips and never stores the plaintext", () => {
    const enc = encryptSecret("SG.super-secret-key")!;
    expect(isEncrypted(enc)).toBe(true);
    expect(enc).not.toContain("super-secret");
    expect(decryptSecret(enc)).toBe("SG.super-secret-key");
  });

  it("uses a random IV (same input, different ciphertext)", () => {
    expect(encryptSecret("abc")).not.toBe(encryptSecret("abc"));
  });

  it("keeps legacy plaintext readable and empty values untouched", () => {
    expect(decryptSecret("legacy-plain")).toBe("legacy-plain");
    expect(encryptSecret(null)).toBeNull();
    expect(encryptSecret("")).toBe("");
    const once = encryptSecret("x")!;
    expect(encryptSecret(once)).toBe(once); // no double encryption
  });
});

describe("shuffle (A/B sampling)", () => {
  it("returns a permutation without mutating the input", () => {
    const input = [1, 2, 3, 4, 5, 6];
    const out = shuffle(input);
    expect(out).toHaveLength(6);
    expect([...out].sort()).toEqual(input);
    expect(input).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("does not keep the original order with a deterministic generator", () => {
    expect(shuffle([1, 2, 3, 4], () => 0)).toEqual([2, 3, 4, 1]);
  });
});

describe("injectTracking", () => {
  it("adds signed open, click and unsubscribe URLs and no raw campaign id in the click link", async () => {
    const html = await injectTracking('<html><body><a href="https://example.com/x">x</a></body></html>', 7, 99);
    expect(html).toContain(`/api/track/click/abc123?u=99&t=${signTrackingToken("click", 7, 99)}`);
    expect(html).toContain(`/api/track/open/7/99?t=${signTrackingToken("open", 7, 99)}`);
    expect(html).toContain(`/api/track/unsubscribe/7/99?t=${signTrackingToken("unsubscribe", 7, 99)}`);
    expect(html).not.toContain("?c=");
  });
});

describe("dispatchEmail", () => {
  const params = { to: "a@b.com", subject: "s", html: "<p>h</p>", text: "t", fromName: "n", fromEmail: "f@b.com" };

  it("fails loudly for providers that are not implemented (no fake 'delivered')", async () => {
    for (const provider of ["ses", "smtp"] as const) {
      const result = await dispatchEmail({ provider, apiKey: "k" } as never, params);
      expect(result.delivered).toBe(false);
      expect(result.sandbox).toBe(false);
      expect(result.error).toMatch(/não é suportado/);
    }
  });

  it("keeps the built-in provider as an explicit sandbox", async () => {
    const result = await dispatchEmail({ provider: "mailflow", apiKey: "k" } as never, params);
    expect(result).toMatchObject({ delivered: true, sandbox: true });
  });
});

describe("tracking routes", () => {
  async function withServer(fn: (base: string) => Promise<void>) {
    const app = express();
    registerTrackingRoutes(app);
    const server = app.listen(0);
    const { port } = server.address() as AddressInfo;
    try {
      await fn(`http://127.0.0.1:${port}`);
    } finally {
      server.close();
    }
  }

  beforeEach(() => vi.clearAllMocks());

  it("refuses to unsubscribe without a valid token", async () => {
    await withServer(async (base) => {
      const res = await fetch(`${base}/api/track/unsubscribe/1/2`, { method: "POST" });
      expect(res.status).toBe(400);
      const forged = await fetch(`${base}/api/track/unsubscribe/1/2?t=${signTrackingToken("unsubscribe", 1, 3)}`, { method: "POST" });
      expect(forged.status).toBe(400);
      expect(db.recordUnsubscribeEvent).not.toHaveBeenCalled();
    });
  });

  it("unsubscribes with the token that was emailed", async () => {
    await withServer(async (base) => {
      const res = await fetch(`${base}/api/track/unsubscribe/1/2?t=${signTrackingToken("unsubscribe", 1, 2)}`, { method: "POST" });
      expect(res.status).toBe(200);
      expect(db.recordUnsubscribeEvent).toHaveBeenCalledWith(1, null, 2);
    });
  });

  it("serves the pixel but ignores opens with a bad token", async () => {
    await withServer(async (base) => {
      const res = await fetch(`${base}/api/track/open/1/2?t=nope`);
      expect(res.headers.get("content-type")).toBe("image/gif");
      expect(db.recordOpenEvent).not.toHaveBeenCalled();
    });
  });

  it("attributes clicks to the link's campaign, not to a query parameter", async () => {
    vi.mocked(db.getEmailLinkByShortId).mockResolvedValue({ id: 5, campaignId: 7, url: "https://example.com", shortId: "s" } as never);
    await withServer(async (base) => {
      const res = await fetch(`${base}/api/track/click/s?c=999&u=2&t=${signTrackingToken("click", 7, 2)}`, { redirect: "manual" });
      expect(res.status).toBe(302);
      expect(res.headers.get("location")).toBe("https://example.com");
      expect(db.recordClickEvent).toHaveBeenCalledWith(7, null, 2, "https://example.com", expect.anything(), expect.anything());
    });
  });
});
