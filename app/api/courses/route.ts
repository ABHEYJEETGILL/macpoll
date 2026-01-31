import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { courseCreateSchema } from "@/lib/validation";
import { rateLimit } from "@/lib/rateLimit";
import { requireAuth } from "@/lib/permissions";

function generateJoinCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (user.role === "INSTRUCTOR") {
    const courses = await prisma.course.findMany({
      where: { ownerInstructorId: user.id },
      orderBy: { createdAt: "desc" }
    });
    return NextResponse.json({ courses });
  }

  const enrollments = await prisma.enrollment.findMany({
    where: { userId: user.id },
    include: { course: true },
    orderBy: { createdAt: "desc" }
  });
  return NextResponse.json({
    courses: enrollments.map((e) => e.course)
  });
}

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user || user.role !== "INSTRUCTOR") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const ip = req.headers.get("x-forwarded-for") ?? "local";
  const rl = rateLimit(`create-course:${ip}`, 30, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const json = await req.json().catch(() => null);
  const parsed = courseCreateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { name, term } = parsed.data;

  const joinCode = generateJoinCode();
  const course = await prisma.course.create({
    data: {
      name,
      term,
      joinCode,
      ownerInstructorId: user.id
    }
  });

  await prisma.auditLog.create({
    data: {
      instructorId: user.id,
      action: "CREATE_COURSE",
      metadata: { courseId: course.id }
    }
  });

  return NextResponse.json({ course }, { status: 201 });
}

