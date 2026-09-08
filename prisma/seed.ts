import { PrismaClient, UserRole } from "@prisma/client";
import { config as loadEnv } from "dotenv";
import argon2 from "argon2";

loadEnv();

const prisma = new PrismaClient();

const INSTRUCTOR_EMAIL = process.env.DEMO_INSTRUCTOR_EMAIL || "demo.instructor@mcmaster.ca";
const STUDENT_EMAIL = process.env.DEMO_STUDENT_EMAIL || "demo.student@mcmaster.ca";
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || "password123";

const COURSE_JOIN_CODE = "MAC123";
const SESSION_CODE = "DEMO01";

/** Extra students so the roster and charts have something to show. */
const CLASSMATES = ["ada.lovelace", "alan.turing", "grace.hopper"].map(
  (name) => `${name}@mcmaster.ca`
);

async function upsertUser(email: string, role: UserRole, passwordHash: string) {
  return prisma.user.upsert({
    where: { email },
    update: { role, passwordHash, verifiedAt: new Date() },
    create: { email, role, passwordHash, verifiedAt: new Date() }
  });
}

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to seed demo accounts in production.");
  }

  const passwordHash = await argon2.hash(DEMO_PASSWORD, { type: argon2.argon2id });

  const instructor = await upsertUser(INSTRUCTOR_EMAIL, UserRole.INSTRUCTOR, passwordHash);
  const student = await upsertUser(STUDENT_EMAIL, UserRole.STUDENT, passwordHash);
  const classmates = await Promise.all(
    CLASSMATES.map((email) => upsertUser(email, UserRole.STUDENT, passwordHash))
  );

  const course = await prisma.course.upsert({
    where: { joinCode: COURSE_JOIN_CODE },
    update: { name: "COMP SCI 1JC3", term: "Winter 2026", ownerInstructorId: instructor.id },
    create: {
      name: "COMP SCI 1JC3",
      term: "Winter 2026",
      ownerInstructorId: instructor.id,
      joinCode: COURSE_JOIN_CODE
    }
  });

  for (const enrollee of [student, ...classmates]) {
    await prisma.enrollment.upsert({
      where: { courseId_userId: { courseId: course.id, userId: enrollee.id } },
      update: {},
      create: { courseId: course.id, userId: enrollee.id, roleInCourse: "STUDENT" }
    });
  }

  const session = await prisma.liveSession.upsert({
    where: { sessionCode: SESSION_CODE },
    update: { endedAt: null, courseId: course.id, createdById: instructor.id },
    create: { courseId: course.id, createdById: instructor.id, sessionCode: SESSION_CODE }
  });

  // Rebuild demo polls each run so re-seeding is deterministic.
  await prisma.poll.deleteMany({ where: { liveSessionId: session.id } });

  const closedPoll = await prisma.poll.create({
    data: {
      liveSessionId: session.id,
      type: "MULTIPLE_CHOICE",
      questionText: "Which data structure gives O(1) average lookup?",
      optionsJson: ["Array", "Linked list", "Hash map", "Binary tree"],
      openedAt: new Date(Date.now() - 10 * 60 * 1000),
      closedAt: new Date(Date.now() - 8 * 60 * 1000)
    }
  });

  const answers = ["Hash map", "Hash map", "Array", "Hash map"];
  await Promise.all(
    [student, ...classmates].map((user, index) =>
      prisma.response.create({
        data: { pollId: closedPoll.id, userId: user.id, answerJson: answers[index] ?? "Hash map" }
      })
    )
  );

  await prisma.poll.create({
    data: {
      liveSessionId: session.id,
      type: "MULTIPLE_CHOICE",
      questionText: "How confident are you with TypeScript?",
      optionsJson: ["Very", "Somewhat", "Not yet"],
      allowChange: true,
      openedAt: new Date()
    }
  });

  for (const user of [student, ...classmates]) {
    await prisma.attendance.upsert({
      where: { liveSessionId_userId: { liveSessionId: session.id, userId: user.id } },
      update: { presentBool: true },
      create: { liveSessionId: session.id, userId: user.id, presentBool: true }
    });
  }

  console.log(`Seeded demo data:
  Instructor  ${INSTRUCTOR_EMAIL} / ${DEMO_PASSWORD}
  Student     ${STUDENT_EMAIL} / ${DEMO_PASSWORD}
  Course      ${course.name} (join code ${COURSE_JOIN_CODE})
  Session     code ${SESSION_CODE} with 1 open poll and 1 closed poll`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
