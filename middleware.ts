import { NextResponse, type NextRequest } from "next/server";

const PROTECTED_PREFIXES = ["/dashboard", "/instructor", "/student"];

/**
 * Bounces signed-out visitors to the login page before a protected page
 * renders, so they never see a dashboard skeleton that then redirects.
 *
 * This is a routing convenience, not the security boundary: middleware runs on
 * the edge runtime without node:crypto, so it only checks that a session cookie
 * is present. Every API route independently verifies the signature and the
 * caller's role.
 */
export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  if (!PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  if (req.cookies.has("macpoll_session")) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/auth/login", req.url);
  loginUrl.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/dashboard/:path*", "/instructor/:path*", "/student/:path*"]
};
