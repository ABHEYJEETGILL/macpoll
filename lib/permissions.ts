import { NextRequest } from "next/server";
import { prisma } from "./prisma";
import { getCurrentUserFromRequest } from "./auth";

export async function requireAuth(req: NextRequest) {
  const user = await getCurrentUserFromRequest(req);
  if (!user) {
    return null;
  }
  return user;
}

export async function requireInstructorForCourse(userId: string, courseId: string) {
  const course = await prisma.course.findFirst({
    where: {
      id: courseId,
      ownerInstructorId: userId
    }
  });
  return course;
}

export async function isEnrolledInCourse(userId: string, courseId: string) {
  const enrollment = await prisma.enrollment.findFirst({
    where: {
      courseId,
      userId
    }
  });
  return !!enrollment;
}

