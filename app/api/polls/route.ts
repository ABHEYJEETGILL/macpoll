import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { route, Errors } from "@/lib/api";
import { pollCreateSchema, pollUpdateSchema } from "@/lib/validation";
import { requireOwnedSession } from "@/lib/permissions";
import { publish } from "@/lib/realtime";
import { TRUE_FALSE_OPTIONS } from "@/lib/answers";
import type { z } from "zod";

type CreateBody = z.infer<typeof pollCreateSchema>;
type UpdateBody = z.infer<typeof pollUpdateSchema>;

export const POST = route<CreateBody>(
  {
    auth: "INSTRUCTOR",
    body: pollCreateSchema,
    rateLimit: { name: "create-poll", limit: 120, windowMs: 60_000 }
  },
  async ({ body, user }) => {
    const session = await requireOwnedSession(user.id, body.liveSessionId);
    if (session.endedAt) throw Errors.badRequest("This session has already ended.");

    const options =
      body.type === "MULTIPLE_CHOICE"
        ? body.options
        : body.type === "TRUE_FALSE"
          ? [...TRUE_FALSE_OPTIONS]
          : undefined;

    // Launching a poll closes whatever was open, so students only ever see one
    // question and results cannot be split across two live polls.
    const poll = await prisma.$transaction(async (tx) => {
      await tx.poll.updateMany({
        where: { liveSessionId: session.id, openedAt: { not: null }, closedAt: null },
        data: { closedAt: new Date() }
      });

      return tx.poll.create({
        data: {
          liveSessionId: session.id,
          type: body.type,
          questionText: body.questionText,
          optionsJson: options,
          isAnonymous: body.isAnonymous,
          allowChange: body.allowChange,
          timeLimitSec: body.timeLimitSec ?? null,
          openedAt: new Date()
        }
      });
    });

    await prisma.auditLog.create({
      data: {
        instructorId: user.id,
        action: "OPEN_POLL",
        metadata: { liveSessionId: session.id, pollId: poll.id }
      }
    });

    await publish(session.sessionCode, { type: "poll-opened", pollId: poll.id });

    return NextResponse.json({ poll }, { status: 201 });
  }
);

export const PATCH = route<UpdateBody>(
  { auth: "INSTRUCTOR", body: pollUpdateSchema },
  async ({ body, user }) => {
    const poll = await prisma.poll.findUnique({
      where: { id: body.pollId },
      include: { liveSession: { include: { course: true } } }
    });

    if (!poll) throw Errors.notFound("Poll");
    if (poll.liveSession.course.ownerInstructorId !== user.id) {
      throw Errors.forbidden("You do not teach this course.");
    }
    if (poll.liveSession.endedAt && !body.close) {
      throw Errors.badRequest("Cannot reopen a poll in a session that has ended.");
    }

    const updated = await prisma.$transaction(async (tx) => {
      // Reopening must close whatever else is open, or two polls would be live
      // at once and students would see an arbitrary one of them.
      if (!body.close) {
        await tx.poll.updateMany({
          where: {
            liveSessionId: poll.liveSessionId,
            id: { not: poll.id },
            openedAt: { not: null },
            closedAt: null
          },
          data: { closedAt: new Date() }
        });
      }

      return tx.poll.update({
        where: { id: poll.id },
        data: { closedAt: body.close ? new Date() : null, openedAt: poll.openedAt ?? new Date() }
      });
    });

    await prisma.auditLog.create({
      data: {
        instructorId: user.id,
        action: body.close ? "CLOSE_POLL" : "REOPEN_POLL",
        metadata: { pollId: poll.id }
      }
    });

    await publish(poll.liveSession.sessionCode, {
      type: body.close ? "poll-closed" : "poll-opened",
      pollId: poll.id
    });

    return NextResponse.json({ poll: updated });
  }
);
