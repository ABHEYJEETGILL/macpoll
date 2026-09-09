import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { Errors, route } from "@/lib/api";
import { publish } from "@/lib/realtime";

const actionSchema = z.object({ action: z.enum(["start", "end"]) });

async function ownedPoll(userId: string, role: string, pollId: string) {
  const poll = await prisma.poll.findUnique({
    where: { id: pollId },
    include: {
      course: { select: { instructorId: true } },
      options: { orderBy: { orderIndex: "asc" } }
    }
  });
  if (!poll) throw Errors.notFound("Poll");
  if (poll.course.instructorId !== userId && role !== "ADMIN") {
    throw Errors.forbidden("You do not own this course.");
  }
  return poll;
}

export const PATCH = route<{ action: "start" | "end" }, { pollId: string }>(
  { roles: ["INSTRUCTOR", "ADMIN"], body: actionSchema },
  async ({ user, params, body }) => {
    const poll = await ownedPoll(user.id, user.role, params.pollId);

    if (body.action === "start") {
      if (poll.status === "ENDED") throw Errors.badRequest("That poll has already ended.");

      const updated = await prisma.poll.update({
        where: { id: poll.id },
        data: { status: "ACTIVE", startedAt: poll.startedAt ?? new Date() },
        include: {
          options: { orderBy: { orderIndex: "asc" } },
          course: { select: { code: true, name: true } },
          _count: { select: { responses: true } }
        }
      });

      // Emitted server-side; clients cannot publish this event themselves. The
      // payload has to match what GET /api/polls returns to a student, since
      // the page renders it directly into the same list.
      await publish(poll.courseId, "poll-started", {
        ...updated,
        options: updated.showContentToStudents
          ? updated.options.map(({ isCorrect: _isCorrect, ...o }) => o)
          : [],
        question: updated.showContentToStudents ? updated.question : null,
        imageUrl: updated.showContentToStudents ? updated.imageUrl : null,
        myResponse: null
      });
      return NextResponse.json(updated);
    }

    const updated = await prisma.poll.update({
      where: { id: poll.id },
      data: { status: "ENDED", endedAt: new Date() },
      include: { options: { orderBy: { orderIndex: "asc" } } }
    });
    await publish(poll.courseId, "poll-ended", { pollId: poll.id });
    return NextResponse.json(updated);
  }
);

export const GET = route<unknown, { pollId: string }>(
  { roles: ["INSTRUCTOR", "ADMIN"] },
  async ({ user, params }) => {
    const poll = await ownedPoll(user.id, user.role, params.pollId);

    const tally = await prisma.pollResponse.groupBy({
      by: ["optionId"],
      where: { pollId: poll.id },
      _count: { _all: true }
    });
    const counts = new Map(tally.map((t) => [t.optionId, t._count._all]));
    const total = tally.reduce((sum, t) => sum + t._count._all, 0);

    const shortAnswers =
      poll.type === "SHORT_ANSWER"
        ? await prisma.pollResponse.findMany({
            where: { pollId: poll.id },
            select: { shortAnswer: true, submittedAt: true },
            orderBy: { submittedAt: "desc" }
          })
        : [];

    return NextResponse.json({
      ...poll,
      total,
      results: poll.options.map((o) => {
        const count = counts.get(o.id) ?? 0;
        return {
          ...o,
          count,
          percent: total === 0 ? 0 : Math.round((count / total) * 100)
        };
      }),
      shortAnswers
    });
  }
);

export const DELETE = route<unknown, { pollId: string }>(
  { roles: ["INSTRUCTOR", "ADMIN"] },
  async ({ user, params }) => {
    const poll = await ownedPoll(user.id, user.role, params.pollId);
    await prisma.poll.delete({ where: { id: poll.id } });
    return NextResponse.json({ success: true });
  }
);
