import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Errors, route } from "@/lib/api";
import { publish } from "@/lib/realtime";
import { sanitizeText } from "@/lib/utils";
import { submitPollResponseSchema } from "@/lib/validation";

export const POST = route(
  {
    roles: ["STUDENT"],
    body: submitPollResponseSchema,
    rateLimit: { limit: 60, windowMs: 60_000, scope: "respond" }
  },
  async ({ user, body }) => {
    const { pollId, optionId, shortAnswer } = body;

    const poll = await prisma.poll.findUnique({
      where: { id: pollId },
      include: { options: { select: { id: true } } }
    });
    if (!poll) throw Errors.notFound("Poll");
    if (poll.status !== "ACTIVE") throw Errors.badRequest("This poll is not open.");

    const enrolled = await prisma.enrollment.findUnique({
      where: { studentId_courseId: { studentId: user.id, courseId: poll.courseId } },
      select: { id: true }
    });
    if (!enrolled) throw Errors.forbidden("You are not enrolled in this course.");

    if (poll.timerSeconds && poll.startedAt) {
      const closesAt = poll.startedAt.getTime() + poll.timerSeconds * 1000;
      if (Date.now() > closesAt) throw Errors.badRequest("Time is up for this poll.");
    }

    // Answer must match the poll's type, checked server-side.
    let answerOptionId: string | null = null;
    let answerText: string | null = null;

    if (poll.type === "SHORT_ANSWER") {
      const cleaned = sanitizeText(shortAnswer ?? "");
      if (!cleaned) throw Errors.badRequest("A text answer is required.");
      answerText = cleaned;
    } else {
      if (!optionId) throw Errors.badRequest("Please select an option.");
      if (!poll.options.some((o) => o.id === optionId)) {
        throw Errors.badRequest("That option does not belong to this poll.");
      }
      answerOptionId = optionId;
    }

    // The unique index on (studentId, pollId) is what actually guarantees one
    // vote per student; this check just turns the race into a clear message.
    const existing = await prisma.pollResponse.findUnique({
      where: { studentId_pollId: { studentId: user.id, pollId } },
      select: { id: true }
    });
    if (existing) throw Errors.conflict("You have already answered this poll.");

    await prisma.$transaction([
      prisma.pollResponse.create({
        data: { studentId: user.id, pollId, optionId: answerOptionId, shortAnswer: answerText }
      }),
      // Append-only audit trail, never overwritten.
      prisma.pollResponseLog.create({
        data: { studentId: user.id, pollId, optionId: answerOptionId, shortAnswer: answerText }
      })
    ]);

    const total = await prisma.pollResponse.count({ where: { pollId } });
    await publish(poll.courseId, "poll-progress", { pollId, total });

    return NextResponse.json({ success: true, total }, { status: 201 });
  }
);
