import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { pollCreateSchema } from "@/lib/validation";
import { rateLimit } from "@/lib/rateLimit";
import { requireAuth } from "@/lib/permissions";

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user || user.role !== "INSTRUCTOR") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const ip = req.headers.get("x-forwarded-for") ?? "local";
  const rl = rateLimit(`create-poll:${ip}`, 240, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const json = await req.json().catch(() => null);
  const parsed = pollCreateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { liveSessionId, type, questionText, options, isAnonymous, allowChange, timeLimitSec } =
    parsed.data;

  const session = await prisma.liveSession.findUnique({
    where: { id: liveSessionId },
    include: { course: true }
  });
  if (!session || session.endedAt || session.course.ownerInstructorId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const poll = await prisma.poll.create({
    data: {
      liveSessionId,
      type,
      questionText,
      optionsJson: options ? options : undefined,
      isAnonymous,
      allowChange,
      timeLimitSec,
      openedAt: new Date()
    }
  });

  await prisma.auditLog.create({
    data: {
      instructorId: user.id,
      action: "CREATE_POLL",
      metadata: { liveSessionId, pollId: poll.id }
    }
  });

  return NextResponse.json({ poll }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user || user.role !== "INSTRUCTOR") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { pollId, close } = await req.json().catch(() => ({ pollId: "", close: false }));
  if (!pollId) {
    return NextResponse.json({ error: "Missing pollId" }, { status: 400 });
  }

  const poll = await prisma.poll.findUnique({
    where: { id: pollId },
    include: { liveSession: { include: { course: true } } }
  });
  if (!poll || poll.liveSession.course.ownerInstructorId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const updated = await prisma.poll.update({
    where: { id: pollId },
    data: {
      closedAt: close ? new Date() : null
    }
  });

  await prisma.auditLog.create({
    data: {
      instructorId: user.id,
      action: close ? "CLOSE_POLL" : "OPEN_POLL",
      metadata: { pollId }
    }
  });

  return NextResponse.json({ poll: updated }, { status: 200 });
}

