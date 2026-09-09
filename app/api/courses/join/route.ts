import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Errors, route } from "@/lib/api";
import { joinCourseSchema } from "@/lib/validation";

export const POST = route(
  { roles: ["STUDENT"], body: joinCourseSchema, rateLimit: { limit: 20, windowMs: 60_000, scope: "course-join" } },
  async ({ user, body }) => {
    const course = await prisma.course.findUnique({ where: { joinCode: body.joinCode } });
    if (!course) throw Errors.badRequest("That join code is not valid.");
    if (!course.isActive) throw Errors.badRequest("That course is no longer accepting students.");

    // Idempotent: re-joining is a no-op rather than an error, and the unique
    // index on (studentId, courseId) settles concurrent submissions.
    await prisma.enrollment.upsert({
      where: { studentId_courseId: { studentId: user.id, courseId: course.id } },
      create: { studentId: user.id, courseId: course.id },
      update: {}
    });

    return NextResponse.json({ ...course, joinCode: undefined });
  }
);
