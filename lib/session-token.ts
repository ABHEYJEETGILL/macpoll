import crypto from "crypto";
import { env } from "./env";

export const SESSION_COOKIE = "macpoll_session";
export const CSRF_COOKIE = "macpoll_csrf";
export const CSRF_HEADER = "x-macpoll-csrf";

export const SESSION_TTL_SECONDS = 60 * 60 * 12;

export type SessionPayload = {
  userId: string;
  role: "INSTRUCTOR" | "STUDENT";
  email: string;
};

export type SignedSession = SessionPayload & { iat: number; exp: number };

function sign(data: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(data).digest("base64url");
}

/** Length-safe constant-time comparison. timingSafeEqual throws on length mismatch. */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function createSessionToken(
  payload: SessionPayload,
  ttlSeconds = SESSION_TTL_SECONDS
): string {
  const now = Math.floor(Date.now() / 1000);
  const body: SignedSession = { ...payload, iat: now, exp: now + ttlSeconds };
  const encoded = Buffer.from(JSON.stringify(body)).toString("base64url");
  return `${encoded}.${sign(encoded, env().SESSION_SECRET)}`;
}

export function verifySessionToken(token: string): SignedSession | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [encoded, signature] = parts;
  if (!safeEqual(signature, sign(encoded, env().SESSION_SECRET))) return null;

  let payload: SignedSession;
  try {
    payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  if (
    typeof payload?.userId !== "string" ||
    typeof payload?.exp !== "number" ||
    (payload.role !== "INSTRUCTOR" && payload.role !== "STUDENT")
  ) {
    return null;
  }

  if (payload.exp <= Math.floor(Date.now() / 1000)) return null;
  return payload;
}

/**
 * Reads one cookie from a raw Cookie header. Splits on the first "=" only, so
 * base64url payloads survive intact.
 */
export function readCookie(cookieHeader: string, name: string): string | null {
  for (const part of cookieHeader.split(";")) {
    const trimmed = part.trim();
    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;
    if (trimmed.slice(0, separator) === name) {
      return decodeURIComponent(trimmed.slice(separator + 1));
    }
  }
  return null;
}
