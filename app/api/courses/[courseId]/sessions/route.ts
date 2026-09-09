import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { route } from "@/lib/api";
import { requireOwnedCourse } from "@/lib/permissions";
import { generateUniqueCode } from "@/lib/codes";

type Params = { courseId: string };

export const GET = route<undefined, Params>(
  { auth: "INSTRUCTOR" },
  async ({ params, user }) => {
    await requireOwnedCourse(user.id, params.courseId);

    const sessions = await prisma.liveSession.findMany({
      where: { courseId: params.courseId },
      orderBy: { startedAt: "desc" },
      include: {
        _count: { select: { polls: true, attendances: true } }
      }
    });

    return NextResponse.json({ sessions });
  }
);

export const POST = route<undefined, Params>(
  {
    auth: "INSTRUCTOR",
    rateLimit: { name: "create-session", limit: 60, windowMs: 60_000 }
  },
  async ({ params, user }) => {
    const course = await requireOwnedCourse(user.id, params.courseId);

    // Only one session per course may be live at a time, so the join code a
    // student is looking at is never ambiguous.
    await prisma.liveSession.updateMany({
      where: { courseId: course.id, endedAt: null },
      data: { endedAt: new Date() }
    });

    const sessionCode = await generateUniqueCode(
      async (code) => (await prisma.liveSession.count({ where: { sessionCode: code } })) > 0
    );

    const session = await prisma.liveSession.create({
      data: { courseId: course.id, createdById: user.id, sessionCode }
    });

    await prisma.auditLog.create({
      data: {
        instructorId: user.id,
        action: "CREATE_SESSION",
        metadata: { courseId: course.id, liveSessionId: session.id }
      }
    });

    return NextResponse.json(
      { session: { ...session, _count: { polls: 0, attendances: 0 } } },
      { status: 201 }
    );
  }
);
