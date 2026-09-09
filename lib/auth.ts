import { createHmac, timingSafeEqual } from "crypto";
import argon2 from "argon2";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { env, isProduction } from "./env";

export const SESSION_COOKIE = "macpoll_session";
export const CSRF_COOKIE = "macpoll_csrf";
export const CSRF_HEADER = "x-csrf-token";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export type Role = "STUDENT" | "INSTRUCTOR" | "ADMIN";

export type SessionPayload = {
  id: string;
  role: Role;
  email: string;
};

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password);
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

// The CSRF token is an HMAC of the session token, so a token minted for one
// session cannot be replayed against another. It is readable by JS (the client
// echoes it back in a header); knowing it is useless without the paired
// httpOnly session cookie.
function deriveCsrfToken(sessionToken: string): string {
  return createHmac("sha256", env().SESSION_SECRET).update(sessionToken).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function setSessionCookie(payload: SessionPayload): { csrfToken: string } {
  const token = jwt.sign(payload, env().SESSION_SECRET, { expiresIn: "7d" });
  const csrfToken = deriveCsrfToken(token);

  const cookieStore = cookies();
  const common = {
    secure: isProduction(),
    sameSite: "lax" as const,
    path: "/",
    maxAge: COOKIE_MAX_AGE
  };

  cookieStore.set(SESSION_COOKIE, token, { ...common, httpOnly: true });
  cookieStore.set(CSRF_COOKIE, csrfToken, { ...common, httpOnly: false });

  return { csrfToken };
}

export function clearSessionCookies(): void {
  const cookieStore = cookies();
  cookieStore.delete(SESSION_COOKIE);
  cookieStore.delete(CSRF_COOKIE);
}

export function getSessionPayload(): SessionPayload | null {
  try {
    const token = cookies().get(SESSION_COOKIE)?.value;
    if (!token) return null;
    const decoded = jwt.verify(token, env().SESSION_SECRET) as jwt.JwtPayload & SessionPayload;
    if (!decoded?.id || !decoded?.role) return null;
    return { id: decoded.id, role: decoded.role, email: decoded.email };
  } catch {
    return null;
  }
}

/** Verifies the submitted CSRF token against the current session cookie. */
export function verifyCsrf(submitted: string | null | undefined): boolean {
  if (!submitted) return false;
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return false;
  return safeEqual(submitted, deriveCsrfToken(token));
}

/** Convenience wrapper used by route handlers: `const session = await auth()`. */
export async function auth(): Promise<{ user: SessionPayload } | null> {
  const payload = getSessionPayload();
  return payload ? { user: payload } : null;
}
