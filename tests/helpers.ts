import { NextRequest } from "next/server";
import argon2 from "argon2";
import { PrismaClient, type UserRole } from "@prisma/client";
import { createSessionToken, SESSION_COOKIE, CSRF_COOKIE } from "@/lib/session-token";

export const prisma = new PrismaClient();

const CSRF_VALUE = "test-csrf-token";

let counter = 0;
function unique(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now()}-${counter}`;
}

export type TestUser = Awaited<ReturnType<typeof createUser>>;

export async function createUser(role: UserRole, password = "password123") {
  const email = `${unique(role.toLowerCase())}@mcmaster.ca`;
  const user = await prisma.user.create({
    data: {
      email,
      role,
      passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
      verifiedAt: new Date()
    }
  });
  return { ...user, password };
}

export async function createCourse(instructor: { id: string }) {
  return prisma.course.create({
    data: {
      name: "Test Course",
      term: "Fall 2026",
      ownerInstructorId: instructor.id,
      joinCode: unique("JC").slice(-8).toUpperCase()
    }
  });
}

export async function enroll(course: { id: string }, user: { id: string }) {
  return prisma.enrollment.create({
    data: { courseId: course.id, userId: user.id, roleInCourse: "STUDENT" }
  });
}

export async function createSession(course: { id: string }, instructor: { id: string }) {
  return prisma.liveSession.create({
    data: {
      courseId: course.id,
      createdById: instructor.id,
      sessionCode: unique("SC").slice(-8).toUpperCase()
    }
  });
}

export async function createPoll(
  session: { id: string },
  overrides: Record<string, unknown> = {}
) {
  return prisma.poll.create({
    data: {
      liveSessionId: session.id,
      type: "MULTIPLE_CHOICE",
      questionText: "Pick one",
      optionsJson: ["A", "B"],
      openedAt: new Date(),
      ...overrides
    } as never
  });
}

type RequestOptions = {
  method?: string;
  body?: unknown;
  user?: { id: string; role: UserRole; email: string } | null;
  /** Omit the CSRF header to exercise the rejection path. */
  csrf?: boolean;
};

export function buildRequest(url: string, options: RequestOptions = {}): NextRequest {
  const { method = "GET", body, user, csrf = true } = options;

  const cookies: string[] = [];
  if (user) {
    const token = createSessionToken({ userId: user.id, role: user.role, email: user.email });
    cookies.push(`${SESSION_COOKIE}=${token}`);
    if (csrf) cookies.push(`${CSRF_COOKIE}=${CSRF_VALUE}`);
  }

  const headers = new Headers();
  if (cookies.length) headers.set("cookie", cookies.join("; "));
  if (body !== undefined) headers.set("content-type", "application/json");
  if (user && csrf) headers.set("x-macpoll-csrf", CSRF_VALUE);

  return new NextRequest(`http://localhost:3000${url}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
}

export async function readJson(response: Response) {
  return { status: response.status, body: await response.json() };
}

/** Removes everything this suite created, honouring FK order via cascades. */
export async function resetDatabase() {
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE "Response","Attendance","Poll","LiveSession","Enrollment","AuditLog","Course","VerificationToken","User" RESTART IDENTITY CASCADE`
  );
}
