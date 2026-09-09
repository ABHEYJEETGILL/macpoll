import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Errors, route } from "@/lib/api";
import { classSessionActionSchema } from "@/lib/validation";

async function ownedSession(userId: string, role: string, sessionId: string) {
  const session = await prisma.classSession.findUnique({
    where: { id: sessionId },
    include: { course: { select: { instructorId: true } } }
  });
  if (!session) throw Errors.notFound("Session");
  if (session.course.instructorId !== userId && role !== "ADMIN") {
    throw Errors.forbidden("You do not own this course.");
  }
  return session;
}

export const PATCH = route<{ action: "activate" | "deactivate" }, { sessionId: string }>(
  { roles: ["INSTRUCTOR", "ADMIN"], body: classSessionActionSchema },
  async ({ user, params, body }) => {
    const session = await ownedSession(user.id, user.role, params.sessionId);

    if (body.action === "deactivate") {
      const updated = await prisma.classSession.update({
        where: { id: session.id },
        data: { isActive: false }
      });
      return NextResponse.json(updated);
    }

    // Only one session per course may be live at a time.
    const [, updated] = await prisma.$transaction([
      prisma.classSession.updateMany({
        where: { courseId: session.courseId, isActive: true },
        data: { isActive: false }
      }),
      prisma.classSession.update({ where: { id: session.id }, data: { isActive: true } })
    ]);
    return NextResponse.json(updated);
  }
);

export const DELETE = route<unknown, { sessionId: string }>(
  { roles: ["INSTRUCTOR", "ADMIN"] },
  async ({ user, params }) => {
    const session = await ownedSession(user.id, user.role, params.sessionId);
    await prisma.classSession.delete({ where: { id: session.id } });
    return NextResponse.json({ success: true });
  }
);
