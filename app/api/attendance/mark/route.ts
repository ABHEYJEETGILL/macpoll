import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { Errors, route } from "@/lib/api";

const schema = z.object({ sessionId: z.string().cuid() });

export const POST = route(
  { roles: ["STUDENT"], body: schema, rateLimit: { limit: 30, windowMs: 60_000, scope: "attendance" } },
  async ({ user, body }) => {
    const session = await prisma.attendanceSession.findUnique({
      where: { id: body.sessionId },
      select: { id: true, courseId: true, isOpen: true, openedAt: true, durationMins: true }
    });
    if (!session) throw Errors.notFound("Attendance session");

    const expired =
      session.durationMins !== null &&
      Date.now() > session.openedAt.getTime() + session.durationMins * 60_000;
    if (!session.isOpen || expired) throw Errors.badRequest("Attendance is closed.");

    const enrolled = await prisma.enrollment.findUnique({
      where: { studentId_courseId: { studentId: user.id, courseId: session.courseId } },
      select: { id: true }
    });
    if (!enrolled) throw Errors.forbidden("You are not enrolled in this course.");

    // Unique (studentId, sessionId) makes re-marking a no-op rather than a duplicate.
    await prisma.attendanceRecord.upsert({
      where: { studentId_sessionId: { studentId: user.id, sessionId: session.id } },
      create: { studentId: user.id, sessionId: session.id },
      update: {}
    });

    return NextResponse.json({ success: true });
  }
);
