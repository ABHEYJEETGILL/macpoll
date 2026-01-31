import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { liveSessionCreateSchema } from "@/lib/validation";
import { rateLimit } from "@/lib/rateLimit";
import { requireAuth, requireInstructorForCourse } from "@/lib/permissions";

function generateSessionCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

type RouteParams = {
  params: { courseId: string };
};

export async function GET(req: NextRequest, { params }: RouteParams) {
  const user = await requireAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const course = await prisma.course.findUnique({
    where: { id: params.courseId }
  });
  if (!course || course.ownerInstructorId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sessions = await prisma.liveSession.findMany({
    where: { courseId: params.courseId },
    orderBy: { startedAt: "desc" }
  });
  return NextResponse.json({ sessions });
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const user = await requireAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const course = await requireInstructorForCourse(user.id, params.courseId);
  if (!course) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const ip = req.headers.get("x-forwarded-for") ?? "local";
  const rl = rateLimit(`create-session:${ip}`, 60, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  // Basic shape validation (courseId already in params)
  const json = await req.json().catch(() => null);
  const parsed = liveSessionCreateSchema.pick({ courseId: true }).safeParse({
    courseId: params.courseId,
    ...(json || {})
  });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const sessionCode = generateSessionCode();
  const session = await prisma.liveSession.create({
    data: {
      courseId: params.courseId,
      createdById: user.id,
      sessionCode
    }
  });

  await prisma.auditLog.create({
    data: {
      instructorId: user.id,
      action: "CREATE_SESSION",
      metadata: { courseId: course.id, liveSessionId: session.id }
    }
  });

  return NextResponse.json({ session }, { status: 201 });
}

