import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { route, Errors } from "@/lib/api";
import { requireOwnedSession } from "@/lib/permissions";
import { csvDocument } from "@/lib/csv";
import { tallyResponses } from "@/lib/answers";

export const GET = route({ auth: "INSTRUCTOR" }, async ({ req, user }) => {
  const liveSessionId = new URL(req.url).searchParams.get("liveSessionId");
  if (!liveSessionId) throw Errors.badRequest("Missing liveSessionId.");

  const session = await requireOwnedSession(user.id, liveSessionId);

  const [enrollments, attendances, polls, participation] = await Promise.all([
    prisma.enrollment.findMany({
      where: { courseId: session.courseId },
      include: { user: { select: { id: true, email: true } } }
    }),
    prisma.attendance.findMany({ where: { liveSessionId: session.id } }),
    prisma.poll.findMany({
      where: { liveSessionId: session.id },
      orderBy: { createdAt: "asc" },
      include: { responses: { select: { answerJson: true, userId: true } } }
    }),
    prisma.pollParticipation.groupBy({
      by: ["userId"],
      where: { poll: { liveSessionId: liveSessionId } },
      _count: { _all: true }
    })
  ]);

  const attendanceByUser = new Map(attendances.map((a) => [a.userId, a]));
  // Answered counts come from participation so anonymous polls, which store no
  // userId on the response, are still reflected.
  const answeredByUser = new Map(participation.map((row) => [row.userId, row._count._all]));
  const rows: unknown[][] = [];

  rows.push(["MacPoll session export"]);
  rows.push(["Course", `${session.course.name} (${session.course.term})`]);
  rows.push(["Session code", session.sessionCode]);
  rows.push(["Started", session.startedAt.toISOString()]);
  rows.push(["Ended", session.endedAt ? session.endedAt.toISOString() : "still live"]);
  rows.push([]);

  // One column per poll so a row reads as a single student's whole lecture.
  rows.push(["Attendance"]);
  rows.push([
    "Email",
    "Present",
    "Joined",
    "First join",
    "Answered",
    ...polls.map((poll, index) => `Q${index + 1}: ${poll.questionText}`)
  ]);

  const answerLookup = new Map<string, string>();
  for (const poll of polls) {
    for (const response of poll.responses) {
      if (!response.userId) continue;
      answerLookup.set(`${poll.id}:${response.userId}`, String(response.answerJson));
    }
  }

  const sorted = [...enrollments].sort((a, b) => a.user.email.localeCompare(b.user.email));
  for (const { user: student } of sorted) {
    const attendance = attendanceByUser.get(student.id);
    const answers = polls.map((poll) => answerLookup.get(`${poll.id}:${student.id}`) ?? "");

    rows.push([
      student.email,
      attendance?.presentBool ? "YES" : "NO",
      attendance ? "YES" : "NO",
      attendance ? attendance.firstJoinAt.toISOString() : "",
      answeredByUser.get(student.id) ?? 0,
      ...answers
    ]);
  }

  rows.push([]);
  rows.push(["Poll results"]);
  rows.push(["#", "Question", "Type", "Anonymous", "Option", "Count", "Percent", "Responses"]);

  polls.forEach((poll, index) => {
    const { tallies, total } = tallyResponses(
      poll,
      poll.responses.map((response) => response.answerJson)
    );

    if (tallies.length === 0) {
      rows.push([index + 1, poll.questionText, poll.type, poll.isAnonymous ? "YES" : "NO", "", 0, "0%", 0]);
      return;
    }

    for (const tally of tallies) {
      rows.push([
        index + 1,
        poll.questionText,
        poll.type,
        poll.isAnonymous ? "YES" : "NO",
        tally.label,
        tally.count,
        `${tally.percent}%`,
        total
      ]);
    }
  });

  // Anonymous polls are excluded from the per-student columns above; note it.
  if (polls.some((poll) => poll.isAnonymous)) {
    rows.push([]);
    rows.push(["Note", "Anonymous polls are reported in aggregate only."]);
  }

  const filename = `macpoll-${session.sessionCode}-${session.startedAt.toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csvDocument(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store"
    }
  });
});

export const dynamic = "force-dynamic";
