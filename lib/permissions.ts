import { prisma } from "./prisma";
import { Errors } from "./api";

/** Loads a course the given instructor owns, or throws 403/404. */
export async function requireOwnedCourse(instructorId: string, courseId: string) {
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) throw Errors.notFound("Course");
  if (course.ownerInstructorId !== instructorId) {
    throw Errors.forbidden("You do not teach this course.");
  }
  return course;
}

/** Loads a live session the given instructor owns, or throws 403/404. */
export async function requireOwnedSession(instructorId: string, sessionId: string) {
  const session = await prisma.liveSession.findUnique({
    where: { id: sessionId },
    include: { course: true }
  });
  if (!session) throw Errors.notFound("Session");
  if (session.course.ownerInstructorId !== instructorId) {
    throw Errors.forbidden("You do not teach this course.");
  }
  return session;
}

export async function isEnrolledInCourse(userId: string, courseId: string): Promise<boolean> {
  const enrollment = await prisma.enrollment.findUnique({
    where: { courseId_userId: { courseId, userId } }
  });
  return enrollment !== null;
}

/**
 * Loads a session a participant may view: either they teach the course or they
 * are enrolled in it. Students reach sessions through a join code, which
 * enrolls them, so a missing enrollment here is a genuine access failure.
 */
export async function requireSessionAccess(
  user: { id: string; role: string },
  sessionId: string
) {
  const session = await prisma.liveSession.findUnique({
    where: { id: sessionId },
    include: { course: true }
  });
  if (!session) throw Errors.notFound("Session");

  if (session.course.ownerInstructorId === user.id) {
    return { session, isInstructor: true as const };
  }

  if (await isEnrolledInCourse(user.id, session.courseId)) {
    return { session, isInstructor: false as const };
  }

  throw Errors.forbidden("You are not enrolled in this course.");
}
