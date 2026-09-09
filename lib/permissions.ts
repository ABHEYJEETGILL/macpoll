import { prisma } from "./prisma";

/** Returns the course if the given user is its owning instructor, else null. */
export async function requireInstructorForCourse(userId: string, courseId: string) {
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course || course.instructorId !== userId) return null;
  return course;
}

/** True if the user is enrolled in the course, or owns it as instructor. */
export async function isEnrolledInCourse(userId: string, courseId: string): Promise<boolean> {
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) return false;
  if (course.instructorId === userId) return true;

  const enrollment = await prisma.enrollment.findUnique({
    where: { studentId_courseId: { studentId: userId, courseId } }
  });
  return enrollment !== null;
}
