import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { enroll, get, makeCourse, makePoll, makeUser, prisma, signIn, signOut } from "../helpers";
import { GET as pollsGet } from "@/app/api/polls/route";

describe("GET /api/polls", () => {
  beforeEach(() => signOut());
  afterAll(async () => prisma.$disconnect());

  it("refuses a student who is not enrolled", async () => {
    const instructor = await makeUser("INSTRUCTOR");
    const course = await makeCourse(instructor.id);
    await makePoll(course.id);
    signIn(await makeUser("STUDENT"));

    const res = await pollsGet(get(`/api/polls?courseId=${course.id}`));
    expect(res.status).toBe(403);
  });

  it("hides draft polls from students but shows them to the instructor", async () => {
    const instructor = await makeUser("INSTRUCTOR");
    const student = await makeUser("STUDENT");
    const course = await makeCourse(instructor.id);
    await makePoll(course.id, { status: "DRAFT" });
    await makePoll(course.id, { status: "ACTIVE" });
    await enroll(student.id, course.id);

    signIn(student);
    const studentBody = await (await pollsGet(get(`/api/polls?courseId=${course.id}`))).json();
    expect(studentBody).toHaveLength(1);
    expect(studentBody[0].status).toBe("ACTIVE");

    signIn(instructor);
    const staffBody = await (await pollsGet(get(`/api/polls?courseId=${course.id}`))).json();
    expect(staffBody).toHaveLength(2);
  });

  it("never sends the correct answer to a student", async () => {
    const instructor = await makeUser("INSTRUCTOR");
    const student = await makeUser("STUDENT");
    const course = await makeCourse(instructor.id);
    await makePoll(course.id);
    await enroll(student.id, course.id);
    signIn(student);

    const body = await (await pollsGet(get(`/api/polls?courseId=${course.id}`))).json();
    for (const option of body[0].options) {
      expect(option).not.toHaveProperty("isCorrect");
    }
  });

  it("sends the correct answer to the instructor", async () => {
    const instructor = await makeUser("INSTRUCTOR");
    const course = await makeCourse(instructor.id);
    await makePoll(course.id);
    signIn(instructor);

    const body = await (await pollsGet(get(`/api/polls?courseId=${course.id}`))).json();
    expect(body[0].options.some((o: { isCorrect: boolean }) => o.isCorrect)).toBe(true);
  });

  it("requires a courseId", async () => {
    signIn(await makeUser("STUDENT"));
    expect((await pollsGet(get("/api/polls"))).status).toBe(400);
  });
});
