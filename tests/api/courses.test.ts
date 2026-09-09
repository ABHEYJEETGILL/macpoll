import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { makeCourse, makeUser, post, prisma, signIn, signOut } from "../helpers";
import { POST as joinPost } from "@/app/api/courses/join/route";

describe("POST /api/courses/join", () => {
  beforeEach(() => signOut());
  afterAll(async () => prisma.$disconnect());

  it("enrols a student holding a valid code", async () => {
    const instructor = await makeUser("INSTRUCTOR");
    const course = await makeCourse(instructor.id);
    const student = await makeUser("STUDENT");
    const session = signIn(student);

    const res = await joinPost(post("/api/courses/join", { joinCode: course.joinCode }, session));
    expect(res.status).toBe(200);

    const enrolment = await prisma.enrollment.findUnique({
      where: { studentId_courseId: { studentId: student.id, courseId: course.id } }
    });
    expect(enrolment).not.toBeNull();
  });

  it("is idempotent when joining twice", async () => {
    const instructor = await makeUser("INSTRUCTOR");
    const course = await makeCourse(instructor.id);
    const student = await makeUser("STUDENT");
    const session = signIn(student);

    await joinPost(post("/api/courses/join", { joinCode: course.joinCode }, session));
    const res = await joinPost(post("/api/courses/join", { joinCode: course.joinCode }, session));

    expect(res.status).toBe(200);
    expect(await prisma.enrollment.count({ where: { courseId: course.id } })).toBe(1);
  });

  it("rejects an unknown code", async () => {
    const session = signIn(await makeUser("STUDENT"));
    const res = await joinPost(post("/api/courses/join", { joinCode: "NOPE99" }, session));
    expect(res.status).toBe(400);
  });

  it("never returns the join code to the student", async () => {
    const instructor = await makeUser("INSTRUCTOR");
    const course = await makeCourse(instructor.id);
    const session = signIn(await makeUser("STUDENT"));

    const body = await (await joinPost(post("/api/courses/join", { joinCode: course.joinCode }, session))).json();
    expect(body.joinCode).toBeUndefined();
  });

  it("refuses an instructor account", async () => {
    const instructor = await makeUser("INSTRUCTOR");
    const course = await makeCourse(instructor.id);
    const session = signIn(await makeUser("INSTRUCTOR"));

    const res = await joinPost(post("/api/courses/join", { joinCode: course.joinCode }, session));
    expect(res.status).toBe(403);
  });
});
