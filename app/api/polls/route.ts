import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Errors, route } from "@/lib/api";
import { isEnrolledInCourse, requireInstructorForCourse } from "@/lib/permissions";
import { pollCreateSchema } from "@/lib/validation";

export const GET = route({ roles: "any" }, async ({ req, user }) => {
  const courseId = req.nextUrl.searchParams.get("courseId");
  const sessionId = req.nextUrl.searchParams.get("sessionId");
  if (!courseId) throw Errors.badRequest("courseId is required.");

  if (!(await isEnrolledInCourse(user.id, courseId))) {
    throw Errors.forbidden("You are not enrolled in this course.");
  }

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { instructorId: true }
  });
  const isStaff = course?.instructorId === user.id || user.role === "ADMIN";

  const polls = await prisma.poll.findMany({
    where: {
      courseId,
      ...(sessionId ? { sessionId } : {}),
      // Students never see polls the instructor has not started.
      ...(isStaff ? {} : { status: { in: ["ACTIVE", "ENDED"] } })
    },
    include: {
      options: { orderBy: { orderIndex: "asc" } },
      course: { select: { code: true, name: true } },
      _count: { select: { responses: true } }
    },
    orderBy: [{ sessionId: "asc" }, { orderIndex: "asc" }, { createdAt: "desc" }]
  });

  if (isStaff) return NextResponse.json(polls);

  const myResponses = await prisma.pollResponse.findMany({
    where: { studentId: user.id, poll: { courseId } },
    select: { pollId: true, optionId: true, shortAnswer: true }
  });
  const mine = new Map(myResponses.map((r) => [r.pollId, r]));

  return NextResponse.json(
    polls.map((poll) => ({
      ...poll,
      // Correct answers never leave the server for a student, and the tally is
      // withheld while the instructor has results hidden.
      options: poll.showContentToStudents
        ? poll.options.map(({ isCorrect: _isCorrect, ...opt }) => opt)
        : [],
      question: poll.showContentToStudents ? poll.question : null,
      imageUrl: poll.showContentToStudents ? poll.imageUrl : null,
      _count: poll.hideResults && poll.status !== "ENDED" ? { responses: 0 } : poll._count,
      resultsHidden: poll.hideResults && poll.status !== "ENDED",
      myResponse: mine.get(poll.id) ?? null
    }))
  );
});

export const POST = route(
  { roles: ["INSTRUCTOR", "ADMIN"], body: pollCreateSchema },
  async ({ user, body }) => {
    const { courseId, sessionId, questionId, options, ...fields } = body;

    const course = await requireInstructorForCourse(user.id, courseId);
    if (!course) throw Errors.forbidden("You do not own this course.");

    if (sessionId) {
      const owned = await prisma.classSession.findFirst({
        where: { id: sessionId, courseId },
        select: { id: true }
      });
      if (!owned) throw Errors.badRequest("That session does not belong to this course.");
    }
    if (questionId) {
      const owned = await prisma.question.findFirst({
        where: { id: questionId, instructorId: user.id },
        select: { id: true }
      });
      if (!owned) throw Errors.badRequest("That question is not in your library.");
    }

    const pollOptions =
      fields.type === "TRUE_FALSE"
        ? [
            { text: "True", isCorrect: false, orderIndex: 0 },
            { text: "False", isCorrect: false, orderIndex: 1 }
          ]
        : fields.type === "MULTIPLE_CHOICE" && options
          ? options.map((o, i) => ({ ...o, orderIndex: i }))
          : [];

    if (fields.type === "MULTIPLE_CHOICE" && pollOptions.length < 2) {
      throw Errors.badRequest("Multiple choice polls need at least 2 options.");
    }

    const poll = await prisma.poll.create({
      data: {
        ...fields,
        courseId,
        sessionId: sessionId ?? null,
        questionId: questionId ?? null,
        imageUrl: fields.imageUrl ?? null,
        timerSeconds: fields.timerSeconds ?? null,
        orderIndex: sessionId ? await prisma.poll.count({ where: { sessionId } }) : 0,
        status: "DRAFT",
        options: { create: pollOptions }
      },
      include: { options: { orderBy: { orderIndex: "asc" } } }
    });

    return NextResponse.json(poll, { status: 201 });
  }
);
