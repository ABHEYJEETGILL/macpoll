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
        orderBy: { openedAt: "desc" }
      }
    }
  });
 
  if (!session || session.course.ownerInstructorId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
 
  return NextResponse.json({
    session: {
      id: session.id,
      sessionCode: session.sessionCode,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      course: { name: session.course.name, id: session.course.id },
      polls: session.polls
    }
  });
}
