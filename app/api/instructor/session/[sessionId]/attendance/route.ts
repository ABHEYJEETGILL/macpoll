import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { route } from "@/lib/api";
import { requireOwnedSession } from "@/lib/permissions";

type Params = { sessionId: string };

/**
 * The full course roster for a session, including enrolled students who never
 * joined, so an instructor can see absences rather than only arrivals.
 */
export const GET = route<undefined, Params>(
  { auth: "INSTRUCTOR" },
  async ({ params, user }) => {
    const session = await requireOwnedSession(user.id, params.sessionId);

    const [enrollments, attendances, pollCount] = await Promise.all([
      prisma.enrollment.findMany({
        where: { courseId: session.courseId },
        include: { user: { select: { id: true, email: true } } }
      }),
      prisma.attendance.findMany({ where: { liveSessionId: session.id } }),
      prisma.poll.count({ where: { liveSessionId: session.id } })
    ]);

    // Counted from participation rather than responses so answers to anonymous
    // polls, which store no userId, still show up here.
    const answerCounts = await prisma.pollParticipation.groupBy({
      by: ["userId"],
      where: { poll: { liveSessionId: session.id } },
      _count: { _all: true }
    });

    const attendanceByUser = new Map(attendances.map((a) => [a.userId, a]));
    const answersByUser = new Map(answerCounts.map((row) => [row.userId, row._count._all]));

    const roster = enrollments
      .map(({ user: student }) => {
        const attendance = attendanceByUser.get(student.id);
        return {
          userId: student.id,
          email: student.email,
          present: attendance?.presentBool ?? false,
          joined: attendance !== undefined,
          firstJoinAt: attendance?.firstJoinAt ?? null,
          answered: answersByUser.get(student.id) ?? 0
        };
      })
      .sort((a, b) => a.email.localeCompare(b.email));

    return NextResponse.json({
      roster,
      pollCount,
      summary: {
        enrolled: roster.length,
        joined: roster.filter((r) => r.joined).length,
        present: roster.filter((r) => r.present).length
      }
    });
  }
);
