import { SignJWT, jwtVerify } from "jose";
import { promisify } from "node:util";
import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";

const scrypt = promisify(scryptCallback);
const SESSION_LIFETIME = "7d";
const SESSION_ISSUER = "mailflow";

function getSessionSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || Buffer.byteLength(secret) < 32) {
    throw new Error("JWT_SECRET must contain at least 32 characters");
  }
  return new TextEncoder().encode(secret);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derivedKey = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt$${salt.toString("base64url")}$${derivedKey.toString("base64url")}`;
}

export async function verifyPassword(
  password: string,
  storedHash: string | null
): Promise<boolean> {
  if (!storedHash) return false;
  const [algorithm, encodedSalt, encodedHash] = storedHash.split("$");
  if (algorithm !== "scrypt" || !encodedSalt || !encodedHash) return false;

  try {
    const salt = Buffer.from(encodedSalt, "base64url");
    const expected = Buffer.from(encodedHash, "base64url");
    if (salt.length !== 16 || expected.length !== 64) return false;
    const actual = (await scrypt(password, salt, expected.length)) as Buffer;
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export async function createSessionToken(userId: number): Promise<string> {
  return new SignJWT({ purpose: "user-session" })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(String(userId))
    .setIssuer(SESSION_ISSUER)
    .setIssuedAt()
    .setExpirationTime(SESSION_LIFETIME)
    .sign(getSessionSecret());
}

export async function verifySessionToken(
  token: string | undefined
): Promise<number | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSessionSecret(), {
      algorithms: ["HS256"],
      issuer: SESSION_ISSUER,
    });
    if (
      payload.purpose !== "user-session" ||
      !payload.sub ||
      !/^[1-9]\d*$/.test(payload.sub)
    ) {
      return null;
    }
    const userId = Number(payload.sub);
    return Number.isSafeInteger(userId) ? userId : null;
  } catch {
    return null;
  }
}
