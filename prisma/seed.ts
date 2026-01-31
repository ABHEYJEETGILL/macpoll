import { PrismaClient, UserRole } from "@prisma/client";
import { hashPassword } from "../lib/auth";

const prisma = new PrismaClient();

async function main() {
  const demoInstructorEmail = process.env.DEMO_INSTRUCTOR_EMAIL || "demo.instructor@mcmaster.ca";
  const demoStudentEmail = process.env.DEMO_STUDENT_EMAIL || "demo.student@mcmaster.ca";

  const instructorPassword = await hashPassword("password123");
  const studentPassword = await hashPassword("password123");

  const instructor = await prisma.user.upsert({
    where: { email: demoInstructorEmail },
    update: {},
    create: {
      email: demoInstructorEmail,
      role: UserRole.INSTRUCTOR,
      passwordHash: instructorPassword,
      verifiedAt: new Date()
    }
  });

  const student = await prisma.user.upsert({
    where: { email: demoStudentEmail },
    update: {},
    create: {
      email: demoStudentEmail,
      role: UserRole.STUDENT,
      passwordHash: studentPassword,
      verifiedAt: new Date()
    }
  });

  const course = await prisma.course.create({
    data: {
      name: "COMP SCI 1JC3",
      term: "Winter 2026",
      ownerInstructorId: instructor.id,
      joinCode: "MAC123"
    }
  });

  await prisma.enrollment.create({
    data: {
      courseId: course.id,
      userId: student.id,
      roleInCourse: "STUDENT"
    }
  });

  const session = await prisma.liveSession.create({
    data: {
      courseId: course.id,
      createdById: instructor.id,
      sessionCode: "DEMO01"
    }
  });

  await prisma.poll.create({
    data: {
      liveSessionId: session.id,
      type: "MULTIPLE_CHOICE",
      questionText: "How confident are you with TypeScript?",
      optionsJson: ["Very", "Somewhat", "Not yet"],
      isAnonymous: false,
      allowChange: true,
      openedAt: new Date()
    }
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

