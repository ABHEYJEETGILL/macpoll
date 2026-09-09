import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { route } from "@/lib/api";
import { requireSessionAccess } from "@/lib/permissions";
import { pollOptions } from "@/lib/answers";

type Params = { sessionId: string };

export const GET = route<undefined, Params>({}, async ({ params, user }) => {
  const { session } = await requireSessionAccess(user, params.sessionId);

  const activePoll = await prisma.poll.findFirst({
    where: { liveSessionId: session.id, openedAt: { not: null }, closedAt: null },
    orderBy: { createdAt: "desc" }
  });

  // A student's own answer, so the UI can show what they picked and whether
  // they are allowed to change it. Anonymous polls store no userId by design.
  const myResponse =
    activePoll && !activePoll.isAnonymous
      ? await prisma.response.findUnique({
          where: { pollId_userId: { pollId: activePoll.id, userId: user.id } }
        })
      : null;

  // Participation covers anonymous polls too, where the response has no userId.
  const answeredCount = await prisma.pollParticipation.count({
    where: { poll: { liveSessionId: session.id }, userId: user.id }
  });

  // For an anonymous poll myAnswer is always null, so the UI needs this to know
  // the student has already taken part.
  const hasAnswered = activePoll
    ? (await prisma.pollParticipation.count({
        where: { pollId: activePoll.id, userId: user.id }
      })) > 0
    : false;

  return NextResponse.json({
    session: {
      id: session.id,
      sessionCode: session.sessionCode,
      endedAt: session.endedAt,
      course: { name: session.course.name }
    },
    activePoll: activePoll
      ? {
          id: activePoll.id,
          type: activePoll.type,
          questionText: activePoll.questionText,
          options: pollOptions(activePoll),
          isAnonymous: activePoll.isAnonymous,
          allowChange: activePoll.allowChange,
          timeLimitSec: activePoll.timeLimitSec,
          openedAt: activePoll.openedAt
        }
      : null,
    myAnswer: myResponse?.answerJson ?? null,
    hasAnswered,
    answeredCount
  });
});
