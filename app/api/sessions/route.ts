import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Errors, route } from "@/lib/api";
import { isEnrolledInCourse, requireInstructorForCourse } from "@/lib/permissions";
import { classSessionCreateSchema } from "@/lib/validation";

export const GET = route({ roles: "any" }, async ({ req, user }) => {
  const courseId = req.nextUrl.searchParams.get("courseId");
  if (!courseId) throw Errors.badRequest("courseId is required.");

  // Previously any signed-in user could read any course's sessions.
  if (!(await isEnrolledInCourse(user.id, courseId))) {
    throw Errors.forbidden("You are not enrolled in this course.");
  }

  const sessions = await prisma.classSession.findMany({
    where: { courseId },
    include: { _count: { select: { polls: true } } },
    orderBy: { date: "desc" }
  });
  return NextResponse.json(sessions);
});

export const POST = route(
  { roles: ["INSTRUCTOR", "ADMIN"], body: classSessionCreateSchema },
  async ({ user, body }) => {
    const course = await requireInstructorForCourse(user.id, body.courseId);
    if (!course) throw Errors.forbidden("You do not own this course.");

    const session = await prisma.classSession.create({
      data: {
        courseId: body.courseId,
        title: body.title,
        description: body.description,
        date: body.date ? new Date(body.date) : new Date()
      },
      include: { _count: { select: { polls: true } } }
    });

    return NextResponse.json(session, { status: 201 });
  }
);
