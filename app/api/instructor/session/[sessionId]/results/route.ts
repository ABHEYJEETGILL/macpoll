import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { route } from "@/lib/api";
import { requireOwnedSession } from "@/lib/permissions";
import { tallyResponses, numericSummary, pollOptions } from "@/lib/answers";

type Params = { sessionId: string };

/**
 * Live aggregates for every poll in the session. The previous version returned
 * only the open poll, so past questions could not be revisited.
 */
export const GET = route<undefined, Params>(
  { auth: "INSTRUCTOR" },
  async ({ params, user }) => {
    const session = await requireOwnedSession(user.id, params.sessionId);

    const polls = await prisma.poll.findMany({
      where: { liveSessionId: session.id },
      orderBy: { createdAt: "desc" },
      include: { responses: { select: { answerJson: true } } }
    });

    const attendance = await prisma.attendance.aggregate({
      where: { liveSessionId: session.id },
      _count: { _all: true }
    });
    const presentCount = await prisma.attendance.count({
      where: { liveSessionId: session.id, presentBool: true }
    });

    const results = polls.map((poll) => {
      const answers = poll.responses.map((response) => response.answerJson);
      const { tallies, total } = tallyResponses(poll, answers);

      return {
        pollId: poll.id,
        type: poll.type,
        questionText: poll.questionText,
        options: pollOptions(poll),
        isOpen: Boolean(poll.openedAt) && !poll.closedAt,
        openedAt: poll.openedAt,
        closedAt: poll.closedAt,
        timeLimitSec: poll.timeLimitSec,
        tallies,
        total,
        numeric: poll.type === "NUMERIC" ? numericSummary(answers) : null
      };
    });

    return NextResponse.json({
      current: results.find((result) => result.isOpen) ?? null,
      results,
      attendance: { joined: attendance._count._all, present: presentCount }
    });
  }
);
