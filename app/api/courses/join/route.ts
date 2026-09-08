import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { route, Errors } from "@/lib/api";
import { joinCourseSchema } from "@/lib/validation";

export const POST = route(
  {
    body: joinCourseSchema,
    rateLimit: { name: "join-course", limit: 30, windowMs: 60_000 }
  },
  async ({ body, user }) => {
    const course = await prisma.course.findUnique({
      where: { joinCode: body.joinCode },
      include: { ownerInstructor: { select: { email: true } } }
    });
    if (!course) throw Errors.badRequest("That join code does not match any course.");

    if (course.ownerInstructorId === user.id) {
      throw Errors.badRequest("You teach this course, so you are already on its roster.");
    }

    const existing = await prisma.enrollment.findUnique({
      where: { courseId_userId: { courseId: course.id, userId: user.id } }
    });

    if (!existing) {
      await prisma.enrollment.create({
        data: { courseId: course.id, userId: user.id, roleInCourse: user.role }
      });
    }

    return NextResponse.json(
      {
        course: {
          id: course.id,
          name: course.name,
          term: course.term,
          instructorEmail: course.ownerInstructor.email
        },
        alreadyEnrolled: existing !== null
      },
      { status: existing ? 200 : 201 }
    );
  }
);
