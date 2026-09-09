import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { route, Errors } from "@/lib/api";
import { responseSubmitSchema } from "@/lib/validation";
import { isEnrolledInCourse } from "@/lib/permissions";
import { normalizeAnswer } from "@/lib/answers";
import { publish } from "@/lib/realtime";
import type { z } from "zod";

type Body = z.infer<typeof responseSubmitSchema>;

export const POST = route<Body>(
  {
    body: responseSubmitSchema,
    rateLimit: { name: "submit-response", limit: 120, windowMs: 60_000 }
  },
  async ({ body, user }) => {
    const poll = await prisma.poll.findUnique({
      where: { id: body.pollId },
      include: { liveSession: { include: { course: true } } }
    });

    if (!poll) throw Errors.notFound("Poll");

    const { liveSession } = poll;

    // The original code accepted a response from any signed-in user, letting
    // anyone vote in any course's poll.
    if (liveSession.course.ownerInstructorId === user.id) {
      throw Errors.forbidden("Instructors cannot answer their own polls.");
    }
    if (!(await isEnrolledInCourse(user.id, liveSession.courseId))) {
      throw Errors.forbidden("You are not enrolled in this course.");
    }

    if (liveSession.endedAt) throw Errors.badRequest("This session has ended.");
    if (!poll.openedAt || poll.closedAt) {
      throw Errors.badRequest("This poll is not accepting responses.");
    }

    if (poll.timeLimitSec) {
      const closesAt = poll.openedAt.getTime() + poll.timeLimitSec * 1000;
      if (Date.now() > closesAt) throw Errors.badRequest("Time is up for this poll.");
    }

    const answerJson = normalizeAnswer(poll, body.answer);

    // Anonymous polls store no userId on the response, so the unique
    // (pollId, userId) index on Response cannot dedupe them. PollParticipation
    // records that this user answered this poll without recording their choice.
    //
    // Writing participation first lets its unique index arbitrate concurrent
    // submissions; a read-then-write check would let two simultaneous requests
    // from one student both slip through.
    try {
      await prisma.$transaction(async (tx) => {
        if (poll.isAnonymous) {
          await tx.pollParticipation.create({ data: { pollId: poll.id, userId: user.id } });
          await tx.response.create({ data: { pollId: poll.id, answerJson } });
          return;
        }

        const participation = await tx.pollParticipation.findUnique({
          where: { pollId_userId: { pollId: poll.id, userId: user.id } }
        });

        if (participation && !poll.allowChange) {
          throw Errors.conflict("You have already answered and this poll does not allow changes.");
        }

        if (!participation) {
          await tx.pollParticipation.create({ data: { pollId: poll.id, userId: user.id } });
        }

        await tx.response.upsert({
          where: { pollId_userId: { pollId: poll.id, userId: user.id } },
          update: { answerJson },
          create: { pollId: poll.id, userId: user.id, answerJson }
        });
      });
    } catch (error) {
      // P2002 is a unique-constraint violation: the student already answered.
      if ((error as { code?: string }).code === "P2002") {
        throw Errors.conflict("You have already answered this poll.");
      }
      throw error;
    }

    await prisma.attendance.upsert({
      where: { liveSessionId_userId: { liveSessionId: liveSession.id, userId: user.id } },
      update: { presentBool: true },
      create: { liveSessionId: liveSession.id, userId: user.id, presentBool: true }
    });

    const total = await prisma.response.count({ where: { pollId: poll.id } });
    await publish(liveSession.sessionCode, {
      type: "response-submitted",
      pollId: poll.id,
      total
    });

    return NextResponse.json({ answer: answerJson, total }, { status: 201 });
  }
);
