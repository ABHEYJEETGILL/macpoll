import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Errors, route } from "@/lib/api";
import { generateUniqueCode } from "@/lib/codes";
import { courseCreateSchema } from "@/lib/validation";

export const GET = route({ roles: "any" }, async ({ user }) => {
  if (user.role === "INSTRUCTOR" || user.role === "ADMIN") {
    const courses = await prisma.course.findMany({
      where: { instructorId: user.id },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { enrollments: true, polls: true } } }
    });
    return NextResponse.json(courses);
  }

  const enrollments = await prisma.enrollment.findMany({
    where: { studentId: user.id },
    include: { course: true },
    orderBy: { enrolledAt: "desc" }
  });
  return NextResponse.json(enrollments.map((e) => e.course));
});

export const POST = route(
  { roles: ["INSTRUCTOR", "ADMIN"], body: courseCreateSchema, rateLimit: { limit: 30, windowMs: 60_000, scope: "course-create" } },
  async ({ user, body }) => {
    const joinCode = await generateUniqueCode(async (code) => {
      return (await prisma.course.findUnique({ where: { joinCode: code }, select: { id: true } })) !== null;
    });
    if (!joinCode) throw Errors.conflict("Could not allocate a join code. Try again.");

    const course = await prisma.course.create({
      data: { ...body, joinCode, instructorId: user.id }
    });

    return NextResponse.json(course, { status: 201 });
  }
);
