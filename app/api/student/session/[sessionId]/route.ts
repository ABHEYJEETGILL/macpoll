import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isEnrolledInCourse } from "@/lib/permissions";

type RouteParams = {
  params: { sessionId: string };
};

export async function GET(req: NextRequest, { params }: RouteParams) {
  const user = await requireAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const session = await prisma.liveSession.findUnique({
    where: { id: params.sessionId },
    include: {
      course: true,
      polls: {
        orderBy: { openedAt: "desc" }
      }
    }
  });

  if (!session) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const enrolled = await isEnrolledInCourse(user.id, session.courseId);
  if (!enrolled) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const activePoll = session.polls.find((p) => p.openedAt && !p.closedAt) ?? null;

  return NextResponse.json({
    session: {
      id: session.id,
      sessionCode: session.sessionCode,
      course: {
        name: session.course.name
      },
      polls: session.polls
    },
    activePoll
  });
}

