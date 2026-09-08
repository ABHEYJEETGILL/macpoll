import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { route, Errors } from "@/lib/api";
import { requireOwnedSession } from "@/lib/permissions";
import { publish } from "@/lib/realtime";

type Params = { sessionId: string };

/** Ends a live session and closes any poll still open inside it. */
export const POST = route<undefined, Params>(
  { auth: "INSTRUCTOR" },
  async ({ params, user }) => {
    const session = await requireOwnedSession(user.id, params.sessionId);
    if (session.endedAt) throw Errors.badRequest("This session has already ended.");

    const endedAt = new Date();
    await prisma.$transaction([
      prisma.poll.updateMany({
        where: { liveSessionId: session.id, openedAt: { not: null }, closedAt: null },
        data: { closedAt: endedAt }
      }),
      prisma.liveSession.update({ where: { id: session.id }, data: { endedAt } }),
      prisma.auditLog.create({
        data: {
          instructorId: user.id,
          action: "END_SESSION",
          metadata: { liveSessionId: session.id }
        }
      })
    ]);

    await publish(session.sessionCode, { type: "session-ended" });

    return NextResponse.json({ session: { id: session.id, endedAt } });
  }
);
