import argon2 from "argon2";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
 
const SESSION_COOKIE = "macpoll_session";
const CSRF_COOKIE = "macpoll_csrf";
const SESSION_SECRET = process.env.SESSION_SECRET ?? "dev-secret-change-me";
const JWT_SECRET = process.env.JWT_SECRET ?? "dev-jwt-secret-change-me";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days
 
export type SessionPayload = {
  id: string;
  role: "INSTRUCTOR" | "STUDENT";
  email: string;
};
 
// ── Password helpers ──────────────────────────────────────────────────────────
 
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
 
// ── Session cookie ────────────────────────────────────────────────────────────
 
export function setSessionCookie(payload: SessionPayload): { csrfToken: string } {
  const token = jwt.sign({ ...payload }, SESSION_SECRET, { expiresIn: "7d" });
  const csrfToken = jwt.sign({ csrf: true }, JWT_SECRET, { expiresIn: "7d" });
 
  const cookieStore = cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE
  });
  cookieStore.set(CSRF_COOKIE, csrfToken, {
    httpOnly: false, // readable by JS so client can attach it as a header
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE
  });
 
  return { csrfToken };
}
 
export function clearSessionCookies(): void {
  const cookieStore = cookies();
  cookieStore.delete(SESSION_COOKIE);
  cookieStore.delete(CSRF_COOKIE);
}
 
export function getSessionPayload(): SessionPayload | null {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get(SESSION_COOKIE)?.value;
    if (!token) return null;
    const payload = jwt.verify(token, SESSION_SECRET) as SessionPayload;
    return payload;
  } catch {
    return null;
  }
}