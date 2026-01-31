import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/permissions";
import { rateLimit } from "@/lib/rateLimit";

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ip = req.headers.get("x-forwarded-for") ?? "local";
  const rl = rateLimit(`join-session:${ip}`, 120, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const { sessionCode } = await req.json().catch(() => ({ sessionCode: "" }));
  if (!sessionCode) {
    return NextResponse.json({ error: "Missing session code" }, { status: 400 });
  }

  const session = await prisma.liveSession.findUnique({
    where: { sessionCode },
    include: { course: true }
  });
  if (!session || session.endedAt) {
    return NextResponse.json({ error: "Session not found or ended" }, { status: 404 });
  }

  // Mark attendance (first join)
  await prisma.attendance.upsert({
    where: {
      liveSessionId_userId: {
        liveSessionId: session.id,
        userId: user.id
      }
    },
    update: {},
    create: {
      liveSessionId: session.id,
      userId: user.id,
      presentBool: false
    }
  });

  return NextResponse.json({ session }, { status: 200 });
}

