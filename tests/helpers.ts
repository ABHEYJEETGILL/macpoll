import { vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";
import { createHmac } from "crypto";

export const prisma = new PrismaClient();

type Cookie = { name: string; value: string };

// One mutable cookie jar shared with the mocked next/headers module, so a test
// can "sign in" by calling signIn() before invoking a route handler.
export const cookieJar = new Map<string, string>();

vi.mock("next/headers", () => ({
  cookies: () => ({
    get: (name: string): Cookie | undefined => {
      const value = cookieJar.get(name);
      return value === undefined ? undefined : { name, value };
    },
    set: (name: string, value: string) => void cookieJar.set(name, value),
    delete: (name: string) => void cookieJar.delete(name)
  })
}));

// Realtime publishing is a side effect over HTTP; tests assert on the database.
vi.mock("@/lib/realtime", () => ({ publish: vi.fn(async () => {}) }));

export type Session = { token: string; csrf: string };

export function signIn(user: { id: string; role: string; email: string }): Session {
  const secret = process.env.SESSION_SECRET!;
  const token = jwt.sign({ id: user.id, role: user.role, email: user.email }, secret, {
    expiresIn: "1h"
  });
  const csrf = createHmac("sha256", secret).update(token).digest("hex");
  cookieJar.set("macpoll_session", token);
  cookieJar.set("macpoll_csrf", csrf);
  return { token, csrf };
}

export function signOut(): void {
  cookieJar.clear();
}

let counter = 0;
const uniq = () => `${Date.now()}-${counter++}`;

export async function makeUser(role: "STUDENT" | "INSTRUCTOR" | "ADMIN" = "STUDENT") {
  return prisma.user.create({
    data: {
      name: `Test ${role}`,
      email: `test-${uniq()}@mcmaster.ca`,
      password: "not-a-real-hash",
      role,
      emailVerified: true
    }
  });
}

export async function makeCourse(instructorId: string) {
  return prisma.course.create({
    data: {
      name: "Test Course",
      code: `TEST-${uniq()}`,
      // Stored uppercase: joinCourseSchema uppercases whatever a student types.
      joinCode: `J${(counter++).toString(36)}${Math.random().toString(36).slice(2, 8)}`.toUpperCase(),
      instructorId
    }
  });
}

export async function enroll(studentId: string, courseId: string) {
  return prisma.enrollment.create({ data: { studentId, courseId } });
}

export async function makePoll(
  courseId: string,
  overrides: { status?: "DRAFT" | "ACTIVE" | "ENDED"; type?: "MULTIPLE_CHOICE" | "SHORT_ANSWER" } = {}
) {
  return prisma.poll.create({
    data: {
      courseId,
      title: "Test poll",
      question: "Which one?",
      type: overrides.type ?? "MULTIPLE_CHOICE",
      status: overrides.status ?? "ACTIVE",
      startedAt: new Date(),
      options: {
        create: [
          { text: "A", isCorrect: true, orderIndex: 0 },
          { text: "B", isCorrect: false, orderIndex: 1 }
        ]
      }
    },
    include: { options: { orderBy: { orderIndex: "asc" } } }
  });
}

/** Builds a NextRequest carrying the current session's CSRF header. */
export function post(url: string, body: unknown, session?: Session) {
  const { NextRequest } = require("next/server");
  return new NextRequest(`http://localhost:3000${url}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(session ? { "x-csrf-token": session.csrf } : {})
    },
    body: JSON.stringify(body)
  });
}

export function get(url: string) {
  const { NextRequest } = require("next/server");
  return new NextRequest(`http://localhost:3000${url}`, { method: "GET" });
}
