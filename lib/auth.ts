import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import crypto from "crypto";
import argon2 from "argon2";
import { prisma } from "./prisma";

const SESSION_COOKIE = "macpoll_session";
const CSRF_COOKIE = "macpoll_csrf";

type SessionPayload = {
  userId: string;
  role: "INSTRUCTOR" | "STUDENT";
  email: string;
};

function getSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET not configured");
  }
  return secret;
}

export async function hashPassword(password: string) {
  return argon2.hash(password);
}

export async function verifyPassword(hash: string, password: string) {
  return argon2.verify(hash, password);
}

export function createSessionToken(payload: SessionPayload) {
  const secret = getSecret();
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const data = `${header}.${body}`;
  const sig = crypto.createHmac("sha256", secret).update(data).digest("base64url");
  return `${data}.${sig}`;
}

export function verifySessionToken(token: string): SessionPayload | null {
  const secret = getSecret();
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, body, sig] = parts;
  const data = `${header}.${body}`;
  const expected = crypto.createHmac("sha256", secret).update(data).digest("base64url");
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    return payload;
  } catch {
    return null;
  }
}

export async function getCurrentUserFromRequest(req: NextRequest) {
  const cookieHeader = req.headers.get("cookie") ?? "";
  const sessionCookie = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${SESSION_COOKIE}=`));

  if (!sessionCookie) return null;
  const token = sessionCookie.split("=")[1];
  const payload = verifySessionToken(token);
  if (!payload) return null;

  const user = await prisma.user.findUnique({
    where: { id: payload.userId }
  });
  if (!user) return null;
  return user;
}

export function setSessionCookie(payload: SessionPayload) {
  const token = createSessionToken(payload);
  const cookieStore = cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 4 // 4 hours
  });
  // Also set CSRF token
  const csrfToken = crypto.randomBytes(32).toString("hex");
  cookieStore.set(CSRF_COOKIE, csrfToken, {
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 4
  });
  return { csrfToken };
}

export function clearSessionCookie() {
  const cookieStore = cookies();
  cookieStore.delete(SESSION_COOKIE);
  cookieStore.delete(CSRF_COOKIE);
}

export function requireCsrf(req: NextRequest) {
  const csrfHeader = req.headers.get("x-macpoll-csrf");
  const cookieHeader = req.headers.get("cookie") ?? "";
  const csrfCookie = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${CSRF_COOKIE}=`));

  if (!csrfCookie || !csrfHeader) {
    return false;
  }
  const value = csrfCookie.split("=")[1];
  return value === csrfHeader;
}

