import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/permissions";

type RouteParams = {
  params: { sessionId: string };
};

export async function GET(req: NextRequest, { params }: RouteParams) {
  const user = await requireAuth(req);
  if (!user || user.role !== "INSTRUCTOR") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const session = await prisma.liveSession.findUnique({
    where: { id: params.sessionId },
    include: {
      course: true,
      polls: {
        include: { responses: true },
        orderBy: { openedAt: "desc" }
      }
    }
  });

  if (!session || session.course.ownerInstructorId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const active = session.polls.find((p) => p.openedAt && !p.closedAt);
  if (!active) {
    return NextResponse.json({ current: null });
  }

  const counts: Record<string, number> = {};
  for (const r of active.responses) {
    const val = r.answerJson as any;
    const key = typeof val === "string" ? val : JSON.stringify(val);
    counts[key] = (counts[key] ?? 0) + 1;
  }

  return NextResponse.json({
    current: {
      pollId: active.id,
      counts
    }
  });
}

