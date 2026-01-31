import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { joinCourseSchema } from "@/lib/validation";
import { rateLimit } from "@/lib/rateLimit";
import { requireAuth } from "@/lib/permissions";

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ip = req.headers.get("x-forwarded-for") ?? "local";
  const rl = rateLimit(`join-course:${ip}`, 60, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const json = await req.json().catch(() => null);
  const parsed = joinCourseSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { joinCode } = parsed.data;
  const course = await prisma.course.findUnique({ where: { joinCode } });
  if (!course) {
    return NextResponse.json({ error: "Invalid join code" }, { status: 400 });
  }

  const existing = await prisma.enrollment.findFirst({
    where: { courseId: course.id, userId: user.id }
  });
  if (existing) {
    return NextResponse.json({ course }, { status: 200 });
  }

  await prisma.enrollment.create({
    data: {
      courseId: course.id,
      userId: user.id,
      roleInCourse: user.role
    }
  });

  return NextResponse.json({ course }, { status: 201 });
}

