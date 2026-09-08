import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionFromRequest, readCookie, CSRF_COOKIE } from "@/lib/auth";

/**
 * Returns the signed-in user, or null. Deliberately not wrapped in `route`:
 * an absent session is a normal answer here, not a 401, so the client can
 * bootstrap without treating logged-out as an error.
 */
export async function GET(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ user: null });

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) return NextResponse.json({ user: null });

  return NextResponse.json({
    user: { id: user.id, email: user.email, role: user.role, verifiedAt: user.verifiedAt },
    csrfToken: readCookie(req.headers.get("cookie") ?? "", CSRF_COOKIE)
  });
}
