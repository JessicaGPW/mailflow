import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { parse as parseCookie } from "cookie";
import { COOKIE_NAME } from "@shared/const";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { verifySessionToken } from "./localAuth";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  const sessionToken = parseCookie(opts.req.headers.cookie ?? "")[COOKIE_NAME];
  const userId = await verifySessionToken(sessionToken);
  if (userId) {
    const account = await db.getUserById(userId);
    if (account) user = { ...account, passwordHash: null };
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
