import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { route, Errors } from "@/lib/api";
import { joinSessionSchema } from "@/lib/validation";

export const POST = route(
  {
    body: joinSessionSchema,
    rateLimit: { name: "join-session", limit: 60, windowMs: 60_000 }
  },
  async ({ body, user }) => {
    const session = await prisma.liveSession.findUnique({
      where: { sessionCode: body.sessionCode },
      include: { course: true }
    });

    if (!session) throw Errors.notFound("Session");
    if (session.endedAt) throw Errors.badRequest("That session has already ended.");

    const isInstructor = session.course.ownerInstructorId === user.id;

    if (!isInstructor) {
      // Holding a live session code is itself proof of attendance, so joining
      // enrolls the student. Without this a student who was given only the
      // session code could join and then be locked out of the session page.
      await prisma.enrollment.upsert({
        where: { courseId_userId: { courseId: session.courseId, userId: user.id } },
        update: {},
        create: { courseId: session.courseId, userId: user.id, roleInCourse: user.role }
      });

      await prisma.attendance.upsert({
        where: { liveSessionId_userId: { liveSessionId: session.id, userId: user.id } },
        update: {},
        create: { liveSessionId: session.id, userId: user.id, presentBool: false }
      });
    }

    return NextResponse.json({
      session: {
        id: session.id,
        sessionCode: session.sessionCode,
        courseName: session.course.name
      },
      isInstructor
    });
  }
);
