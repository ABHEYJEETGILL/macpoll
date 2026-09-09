import { PrismaClient } from "@prisma/client";
import argon2 from "argon2";
 
const prisma = new PrismaClient();
 
async function main() {
  const instructorEmail =
    process.env.DEMO_INSTRUCTOR_EMAIL ?? "demo.instructor@mcmaster.ca";
  const studentEmail =
    process.env.DEMO_STUDENT_EMAIL ?? "demo.student@mcmaster.ca";
  const demoPassword = "demo1234";
 
  const passwordHash = await argon2.hash(demoPassword);
 
  // ── Instructor ──────────────────────────────────────────────────────────────
  const instructor = await prisma.user.upsert({
    where: { email: instructorEmail },
    update: {},
    create: {
      email: instructorEmail,
      passwordHash,
      role: "INSTRUCTOR",
      verifiedAt: new Date()
    }
  });
 
  // ── Student ─────────────────────────────────────────────────────────────────
  const student = await prisma.user.upsert({
    where: { email: studentEmail },
    update: {},
    create: {
      email: studentEmail,
      passwordHash,
      role: "STUDENT",
      verifiedAt: new Date()
    }
  });
 
  // ── Demo course ─────────────────────────────────────────────────────────────
  let course = await prisma.course.findFirst({
    where: { ownerInstructorId: instructor.id }
  });
 
  if (!course) {
    course = await prisma.course.create({
      data: {
        name: "COMPSCI 1JC3 – Introduction to Computational Thinking",
        term: "Winter 2026",
        joinCode: "DEMO01",
        ownerInstructorId: instructor.id
      }
    });
  }
 
  // ── Enrol student ───────────────────────────────────────────────────────────
  await prisma.enrollment.upsert({
    where: { courseId_userId: { courseId: course.id, userId: student.id } },
    update: {},
    create: {
      courseId: course.id,
      userId: student.id,
      roleInCourse: "STUDENT"
    }
  });
 
  console.log("✅ Seed complete");
  console.log(`   Instructor: ${instructorEmail} / ${demoPassword}`);
  console.log(`   Student:    ${studentEmail} / ${demoPassword}`);
  console.log(`   Course join code: ${course.joinCode}`);
}
 
main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
