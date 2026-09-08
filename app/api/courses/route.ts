import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { route } from "@/lib/api";
import { courseCreateSchema } from "@/lib/validation";
import { generateUniqueCode } from "@/lib/codes";

export const GET = route({}, async ({ user }) => {
  if (user.role === "INSTRUCTOR") {
    const courses = await prisma.course.findMany({
      where: { ownerInstructorId: user.id },
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { enrollments: true, liveSessions: true } }
      }
    });
    return NextResponse.json({ courses });
  }

  const enrollments = await prisma.enrollment.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: { course: { include: { ownerInstructor: { select: { email: true } } } } }
  });

  return NextResponse.json({
    courses: enrollments.map(({ course }) => ({
      id: course.id,
      name: course.name,
      term: course.term,
      instructorEmail: course.ownerInstructor.email
    }))
  });
});

export const POST = route(
  {
    auth: "INSTRUCTOR",
    body: courseCreateSchema,
    rateLimit: { name: "create-course", limit: 30, windowMs: 60_000 }
  },
  async ({ body, user }) => {
    const joinCode = await generateUniqueCode(
      async (code) => (await prisma.course.count({ where: { joinCode: code } })) > 0
    );

    const course = await prisma.course.create({
      data: { name: body.name, term: body.term, joinCode, ownerInstructorId: user.id }
    });

    await prisma.auditLog.create({
      data: { instructorId: user.id, action: "CREATE_COURSE", metadata: { courseId: course.id } }
    });

    return NextResponse.json({ course: { ...course, _count: { enrollments: 0, liveSessions: 0 } } }, { status: 201 });
  }
);
