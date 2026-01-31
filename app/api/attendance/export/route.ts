import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/permissions";

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user || user.role !== "INSTRUCTOR") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const liveSessionId = searchParams.get("liveSessionId");
  if (!liveSessionId) {
    return NextResponse.json({ error: "Missing liveSessionId" }, { status: 400 });
  }

  const session = await prisma.liveSession.findUnique({
    where: { id: liveSessionId },
    include: {
      course: true,
      attendances: {
        include: { user: true }
      },
      polls: {
        include: { responses: true }
      }
    }
  });

  if (!session || session.course.ownerInstructorId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const lines: string[] = [];
  lines.push(`Course,${session.course.name} (${session.course.term})`);
  lines.push(`Session Code,${session.sessionCode}`);
  lines.push("");
  lines.push("Attendance");
  lines.push("Email,Present,First Join At");
  for (const a of session.attendances) {
    lines.push(`${a.user.email},${a.presentBool ? "YES" : "NO"},${a.firstJoinAt.toISOString()}`);
  }

  lines.push("");
  lines.push("Poll Results");
  lines.push("Poll Question,Response Count");
  for (const p of session.polls) {
    lines.push(`"${p.questionText.replace(/"/g, '""')}",${p.responses.length}`);
  }

  const csv = lines.join("\n");

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="macpoll-session-${session.sessionCode}.csv"`
    }
  });
}

