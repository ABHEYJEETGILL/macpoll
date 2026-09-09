import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Errors, route } from "@/lib/api";
import { toCsv } from "@/lib/csv";

export const GET = route({ roles: ["INSTRUCTOR", "ADMIN"] }, async ({ req, user }) => {
  const sessionId = req.nextUrl.searchParams.get("sessionId");
  if (!sessionId) throw Errors.badRequest("sessionId is required.");

  const session = await prisma.attendanceSession.findUnique({
    where: { id: sessionId },
    include: {
      course: { select: { name: true, code: true, instructorId: true } },
      records: {
        include: { student: { select: { name: true, email: true } } },
        orderBy: { markedAt: "asc" }
      }
    }
  });
  if (!session) throw Errors.notFound("Attendance session");
  if (session.course.instructorId !== user.id && user.role !== "ADMIN") {
    throw Errors.forbidden("You do not own this course.");
  }

  const enrolled = await prisma.enrollment.findMany({
    where: { courseId: session.courseId },
    include: { student: { select: { id: true, name: true, email: true } } }
  });
  const markedAt = new Map(session.records.map((r) => [r.studentId, r.markedAt]));

  const csv = toCsv(
    ["Name", "Email", "Present", "Marked At"],
    enrolled.map((e) => [
      e.student.name,
      e.student.email,
      markedAt.has(e.student.id) ? "YES" : "NO",
      markedAt.get(e.student.id)?.toISOString() ?? ""
    ])
  );

  const filename = `attendance-${session.course.code}-${session.id}.csv`.replace(
    /[^A-Za-z0-9._-]/g,
    "_"
  );

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`
    }
  });
});
