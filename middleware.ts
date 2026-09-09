import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const SESSION_COOKIE = "macpoll_session";

const PROTECTED_PREFIXES = ["/dashboard", "/instructor", "/student"];
const INSTRUCTOR_ONLY = ["/instructor"];

type Claims = { id?: string; role?: string };

// Runs in the Edge runtime, so it cannot import lib/env (node:crypto). Missing
// secret is treated as "nobody is authenticated" rather than falling back to a
// shared default, which would have made every session forgeable.
async function readClaims(token: string | undefined): Promise<Claims | null> {
  const secret = process.env.SESSION_SECRET;
  if (!token || !secret || secret.length < 32) return null;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
    return payload as Claims;
  } catch {
    return null;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  if (!isProtected) return NextResponse.next();

  const claims = await readClaims(req.cookies.get(SESSION_COOKIE)?.value);

  if (!claims) {
    const loginUrl = new URL("/auth/login", req.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (
    INSTRUCTOR_ONLY.some((p) => pathname.startsWith(p)) &&
    claims.role !== "INSTRUCTOR" &&
    claims.role !== "ADMIN"
  ) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  const response = NextResponse.next();
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  return response;
}

export const config = {
  matcher: ["/dashboard/:path*", "/instructor/:path*", "/student/:path*"]
};
