import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionPayload } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Deliberately public and never 401: the client calls this to ask "am I signed
// in?", so "no" is a normal answer, not an error.
export async function GET() {
  const session = getSessionPayload();
  if (!session) return NextResponse.json({ user: null });

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { id: true, name: true, email: true, role: true, emailVerified: true }
  });
  return NextResponse.json({ user: user ?? null });
}
