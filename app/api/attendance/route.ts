import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Errors, route } from "@/lib/api";
import { isEnrolledInCourse, requireInstructorForCourse } from "@/lib/permissions";
import { publish } from "@/lib/realtime";
import { attendanceOpenSchema } from "@/lib/validation";

export const GET = route({ roles: "any" }, async ({ req, user }) => {
  const courseId = req.nextUrl.searchParams.get("courseId");
  if (!courseId) throw Errors.badRequest("courseId is required.");
  if (!(await isEnrolledInCourse(user.id, courseId))) {
    throw Errors.forbidden("You are not enrolled in this course.");
  }

  const sessions = await prisma.attendanceSession.findMany({
    where: { courseId },
    include: { _count: { select: { records: true } } },
    orderBy: { openedAt: "desc" }
  });

  if (user.role !== "STUDENT") return NextResponse.json(sessions);

  const mine = await prisma.attendanceRecord.findMany({
    where: { studentId: user.id, session: { courseId } },
    select: { sessionId: true }
  });
  const marked = new Set(mine.map((r) => r.sessionId));
  return NextResponse.json(sessions.map((s) => ({ ...s, marked: marked.has(s.id) })));
});

export const POST = route(
  { roles: ["INSTRUCTOR", "ADMIN"], body: attendanceOpenSchema },
  async ({ user, body }) => {
    const course = await requireInstructorForCourse(user.id, body.courseId);
    if (!course) throw Errors.forbidden("You do not own this course.");

    const session = await prisma.attendanceSession.create({
      data: {
        courseId: body.courseId,
        label: body.label,
        durationMins: body.durationMins ?? null
      },
      include: { _count: { select: { records: true } } }
    });

    await publish(body.courseId, "attendance-opened", session);
    return NextResponse.json(session, { status: 201 });
  }
);
