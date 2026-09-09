import { NextRequest } from "next/server";
import { getSessionPayload } from "./auth";
import { prisma } from "./prisma";

export type AuthUser = {
  id: string;
  role: "INSTRUCTOR" | "STUDENT";
  email: string;
};

/**
 * Reads the session cookie from the incoming request and returns the
 * session payload. Returns null if the request is unauthenticated.
 *
 * Note: we call getSessionPayload() which reads from next/headers internally.
 * The `req` parameter is accepted for signature consistency but the cookie
 * is read from the async storage context (works in Next.js 14 route handlers).
 */
export async function requireAuth(_req?: NextRequest): Promise<AuthUser | null> {
  const payload = getSessionPayload();
  if (!payload) return null;
  // Route handlers use user.id — map userId → id here
  return {
    id: payload.id,
    role: payload.role,
    email: payload.email
  };
}
/**
 * Returns the course if the given user is its owning instructor, else null.
 */
export async function requireInstructorForCourse(userId: string, courseId: string) {
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course || course.ownerInstructorId !== userId) return null;
  return course;
}
 
/**
 * Returns true if the user is enrolled in the given course (or owns it).
 */
export async function isEnrolledInCourse(userId: string, courseId: string): Promise<boolean> {
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (course?.ownerInstructorId === userId) return true;
 
  const enrollment = await prisma.enrollment.findFirst({
    where: { courseId, userId }
  });
  return enrollment !== null;
}
 