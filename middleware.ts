import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const SESSION_COOKIE = "macpoll_session";

const PROTECTED_PREFIXES = ["/dashboard", "/instructor", "/student"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  if (!isProtected) return NextResponse.next();

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const isLoggedIn = await verifyToken(token);

  if (!isLoggedIn) {
    const loginUrl = new URL("/auth/login", req.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const response = NextResponse.next();
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  return response;
}

async function verifyToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  try {
    const secret = new TextEncoder().encode(
      process.env.SESSION_SECRET ?? "dev-secret-change-me"
    );
    await jwtVerify(token, secret);
    return true;
  } catch {
    return false;
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};