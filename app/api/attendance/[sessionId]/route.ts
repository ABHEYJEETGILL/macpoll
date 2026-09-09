import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Errors, route } from "@/lib/api";
import { publish } from "@/lib/realtime";

export const PATCH = route<unknown, { sessionId: string }>(
  { roles: ["INSTRUCTOR", "ADMIN"] },
  async ({ user, params }) => {
    const session = await prisma.attendanceSession.findUnique({
      where: { id: params.sessionId },
      include: { course: { select: { instructorId: true } } }
    });
    if (!session) throw Errors.notFound("Attendance session");
    if (session.course.instructorId !== user.id && user.role !== "ADMIN") {
      throw Errors.forbidden("You do not own this course.");
    }

    const updated = await prisma.attendanceSession.update({
      where: { id: session.id },
      data: { isOpen: false, closedAt: new Date() }
    });

    await publish(session.courseId, "attendance-closed", { sessionId: session.id });
    return NextResponse.json(updated);
  }
);
