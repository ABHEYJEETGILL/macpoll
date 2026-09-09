import { PrismaClient } from "@prisma/client";
import argon2 from "argon2";

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to seed demo accounts in production.");
  }

  const instructorEmail = process.env.DEMO_INSTRUCTOR_EMAIL ?? "demo.instructor@mcmaster.ca";
  const studentEmail = process.env.DEMO_STUDENT_EMAIL ?? "demo.student@mcmaster.ca";
  const demoPassword = process.env.DEMO_PASSWORD ?? "demo-password-change-me";
  const password = await argon2.hash(demoPassword);

  const instructor = await prisma.user.upsert({
    where: { email: instructorEmail },
    update: {},
    create: {
      name: "Demo Instructor",
      email: instructorEmail,
      password,
      role: "INSTRUCTOR",
      emailVerified: true
    }
  });

  const student = await prisma.user.upsert({
    where: { email: studentEmail },
    update: {},
    create: {
      name: "Demo Student",
      email: studentEmail,
      password,
      role: "STUDENT",
      emailVerified: true
    }
  });

  // Keyed on the fixed join code so re-running the seed is idempotent.
  const course = await prisma.course.upsert({
    where: { joinCode: "DEMO01" },
    update: {},
    create: {
      name: "Introduction to Computational Thinking",
      code: "COMPSCI 1JC3",
      semester: "Winter 2026",
      joinCode: "DEMO01",
      instructorId: instructor.id
    }
  });

  await prisma.enrollment.upsert({
    where: { studentId_courseId: { studentId: student.id, courseId: course.id } },
    update: {},
    create: { studentId: student.id, courseId: course.id }
  });

  const session = await prisma.classSession.findFirst({
    where: { courseId: course.id, title: "Week 1 - Welcome" }
  });
  const classSession =
    session ??
    (await prisma.classSession.create({
      data: { courseId: course.id, title: "Week 1 - Welcome", isActive: true }
    }));

  const existingPoll = await prisma.poll.findFirst({
    where: { courseId: course.id, title: "Warm-up" }
  });
  if (!existingPoll) {
    await prisma.poll.create({
      data: {
        courseId: course.id,
        sessionId: classSession.id,
        title: "Warm-up",
        question: "Which of these is a programming language?",
        type: "MULTIPLE_CHOICE",
        status: "DRAFT",
        options: {
          create: [
            { text: "Python", isCorrect: true, orderIndex: 0 },
            { text: "Photosynthesis", isCorrect: false, orderIndex: 1 },
            { text: "Pythagoras", isCorrect: false, orderIndex: 2 }
          ]
        }
      }
    });
  }

  console.log("Seed complete");
  console.log(`  Instructor: ${instructorEmail}`);
  console.log(`  Student:    ${studentEmail}`);
  console.log(`  Password:   set via DEMO_PASSWORD`);
  console.log(`  Join code:  ${course.joinCode}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
