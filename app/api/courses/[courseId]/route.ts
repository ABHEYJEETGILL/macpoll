import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Errors, route } from "@/lib/api";
import { isEnrolledInCourse } from "@/lib/permissions";

export const GET = route<unknown, { courseId: string }>(
  { roles: "any" },
  async ({ user, params }) => {
    if (!(await isEnrolledInCourse(user.id, params.courseId))) {
      throw Errors.forbidden("You are not enrolled in this course.");
    }

    const course = await prisma.course.findUnique({
      where: { id: params.courseId },
      include: { _count: { select: { enrollments: true } } }
    });
    if (!course) throw Errors.notFound("Course");

    // The join code is an instructor secret - it grants enrolment.
    const isOwner = course.instructorId === user.id || user.role === "ADMIN";
    return NextResponse.json(isOwner ? course : { ...course, joinCode: undefined });
  }
);
