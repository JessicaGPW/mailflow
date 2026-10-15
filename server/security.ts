import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Security helpers shared by the tracking routes and the SMTP settings.
 *
 * - Tracking tokens: HMAC-SHA256 over (purpose, campaignId, contactId), so a
 *   recipient can only open/click/unsubscribe for the exact pair that was
 *   emailed to them. Sequential IDs alone are no longer enough.
 * - Secret encryption: AES-256-GCM for provider API keys and SMTP passwords
 *   at rest. Values are stored as `enc:v1:<iv>:<tag>:<ciphertext>` (base64url).
 */

function masterSecret(): string {
  const secret = process.env.TRACKING_SECRET || process.env.JWT_SECRET || "";
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("TRACKING_SECRET (or JWT_SECRET) must be set in production");
  }
  // Development/test fallback keeps the app runnable without configuration.
  return secret || "dev-only-insecure-secret";
}

function deriveKey(label: string): Buffer {
  return createHash("sha256").update(`${label}:${masterSecret()}`).digest();
}

// ─────────────────────────────────────────────
// Tracking tokens
// ─────────────────────────────────────────────
export type TrackingPurpose = "open" | "click" | "unsubscribe";

export function signTrackingToken(purpose: TrackingPurpose, campaignId: number, contactId: number): string {
  return createHmac("sha256", deriveKey("tracking"))
    .update(`${purpose}:${campaignId}:${contactId}`)
    .digest("base64url")
    .slice(0, 32);
}

export function verifyTrackingToken(
  purpose: TrackingPurpose,
  campaignId: number,
  contactId: number,
  token: unknown,
): boolean {
  if (typeof token !== "string" || token.length === 0) return false;
  if (!Number.isInteger(campaignId) || !Number.isInteger(contactId)) return false;
  const expected = Buffer.from(signTrackingToken(purpose, campaignId, contactId));
  const given = Buffer.from(token);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

// ─────────────────────────────────────────────
// Secrets at rest
// ─────────────────────────────────────────────
const PREFIX = "enc:v1:";

export function isEncrypted(value: string | null | undefined): boolean {
  return typeof value === "string" && value.startsWith(PREFIX);
}

export function encryptSecret(plain: string | null | undefined): string | null | undefined {
  if (plain === null || plain === undefined || plain === "") return plain;
  if (isEncrypted(plain)) return plain;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", deriveKey("secrets"), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64url")}:${tag.toString("base64url")}:${data.toString("base64url")}`;
}

/** Decrypts values written by `encryptSecret`. Legacy plaintext values are returned as-is. */
export function decryptSecret(value: string | null | undefined): string | null | undefined {
  if (!isEncrypted(value)) return value;
  const [iv, tag, data] = value!.slice(PREFIX.length).split(":");
  const decipher = createDecipheriv("aes-256-gcm", deriveKey("secrets"), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
}

// ─────────────────────────────────────────────
// Misc
// ─────────────────────────────────────────────
/** Unbiased Fisher–Yates shuffle (returns a new array). */
export function shuffle<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
