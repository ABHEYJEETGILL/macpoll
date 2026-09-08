import { cookies } from "next/headers";
import crypto from "crypto";
import argon2 from "argon2";
import { isProduction } from "./env";
import {
  CSRF_COOKIE,
  CSRF_HEADER,
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  createSessionToken,
  readCookie,
  safeEqual,
  verifySessionToken,
  type SessionPayload,
  type SignedSession
} from "./session-token";

export {
  SESSION_COOKIE,
  CSRF_COOKIE,
  CSRF_HEADER,
  createSessionToken,
  verifySessionToken,
  readCookie,
  safeEqual
};
export type { SessionPayload, SignedSession };

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, { type: argon2.argon2id });
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

export function getSessionFromRequest(req: Request): SignedSession | null {
  const token = readCookie(req.headers.get("cookie") ?? "", SESSION_COOKIE);
  if (!token) return null;
  return verifySessionToken(token);
}

export function setSessionCookie(payload: SessionPayload): { csrfToken: string } {
  const store = cookies();
  const secure = isProduction();

  store.set(SESSION_COOKIE, createSessionToken(payload), {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: SESSION_TTL_SECONDS
  });

  // Double-submit CSRF: readable by JS so the client can echo it in a header.
  const csrfToken = crypto.randomBytes(32).toString("hex");
  store.set(CSRF_COOKIE, csrfToken, {
    httpOnly: false,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: SESSION_TTL_SECONDS
  });

  return { csrfToken };
}

export function clearSessionCookie(): void {
  const store = cookies();
  store.delete(SESSION_COOKIE);
  store.delete(CSRF_COOKIE);
}

export function hasValidCsrf(req: Request): boolean {
  const header = req.headers.get(CSRF_HEADER);
  const cookie = readCookie(req.headers.get("cookie") ?? "", CSRF_COOKIE);
  if (!header || !cookie) return false;
  return safeEqual(header, cookie);
}
