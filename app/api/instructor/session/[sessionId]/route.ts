import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { route } from "@/lib/api";
import { requireOwnedSession } from "@/lib/permissions";
import { pollOptions } from "@/lib/answers";

type Params = { sessionId: string };

export const GET = route<undefined, Params>(
  { auth: "INSTRUCTOR" },
  async ({ params, user }) => {
    const session = await requireOwnedSession(user.id, params.sessionId);

    const polls = await prisma.poll.findMany({
      where: { liveSessionId: session.id },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { responses: true } } }
    });

    const enrolledCount = await prisma.enrollment.count({
      where: { courseId: session.courseId }
    });

    return NextResponse.json({
      session: {
        id: session.id,
        sessionCode: session.sessionCode,
        startedAt: session.startedAt,
        endedAt: session.endedAt,
        course: { id: session.course.id, name: session.course.name, term: session.course.term }
      },
      polls: polls.map((poll) => ({
        id: poll.id,
        type: poll.type,
        questionText: poll.questionText,
        options: pollOptions(poll),
        isAnonymous: poll.isAnonymous,
        allowChange: poll.allowChange,
        timeLimitSec: poll.timeLimitSec,
        openedAt: poll.openedAt,
        closedAt: poll.closedAt,
        responseCount: poll._count.responses
      })),
      enrolledCount
    });
  }
);
