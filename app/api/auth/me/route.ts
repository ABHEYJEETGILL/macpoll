import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
 
export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth(req);
    if (!session) {
      return NextResponse.json({ user: null }, { status: 200 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.id },
      select: { id: true, email: true, role: true, verifiedAt: true }
    });

    return NextResponse.json({ user: user ?? null });
  } catch (err) {
    console.error("[GET /api/auth/me]", err);
    return NextResponse.json({ user: null }, { status: 200 });
  }
}
