import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  enroll, get, makeCourse, makePoll, makeUser, post, prisma, signIn, signOut, type Session
} from "../helpers";
import { POST as respondPost } from "@/app/api/polls/respond/route";

async function json(res: Response) {
  return { status: res.status, body: await res.json() };
}

describe("POST /api/polls/respond", () => {
  beforeEach(() => signOut());
  afterAll(async () => prisma.$disconnect());

  async function scenario() {
    const instructor = await makeUser("INSTRUCTOR");
    const student = await makeUser("STUDENT");
    const course = await makeCourse(instructor.id);
    const poll = await makePoll(course.id);
    return { instructor, student, course, poll };
  }

  function submit(body: unknown, session: Session) {
    return respondPost(post("/api/polls/respond", body, session));
  }

  it("accepts one answer from an enrolled student", async () => {
    const { student, course, poll } = await scenario();
    await enroll(student.id, course.id);
    const session = signIn(student);

    const res = await json(await submit({ pollId: poll.id, optionId: poll.options[0].id }, session));
    expect(res.status).toBe(201);

    const saved = await prisma.pollResponse.findMany({ where: { pollId: poll.id } });
    expect(saved).toHaveLength(1);
    expect(saved[0].optionId).toBe(poll.options[0].id);
  });

  it("refuses a student who is not enrolled in the course", async () => {
    const { student, poll } = await scenario();
    const session = signIn(student);

    const res = await json(await submit({ pollId: poll.id, optionId: poll.options[0].id }, session));
    expect(res.status).toBe(403);
    expect(await prisma.pollResponse.count({ where: { pollId: poll.id } })).toBe(0);
  });

  it("refuses a second answer from the same student", async () => {
    const { student, course, poll } = await scenario();
    await enroll(student.id, course.id);
    const session = signIn(student);

    await submit({ pollId: poll.id, optionId: poll.options[0].id }, session);
    const res = await json(await submit({ pollId: poll.id, optionId: poll.options[1].id }, session));

    expect(res.status).toBe(409);
    expect(await prisma.pollResponse.count({ where: { pollId: poll.id } })).toBe(1);
  });

  it("refuses an option belonging to a different poll", async () => {
    const { student, course, poll } = await scenario();
    const other = await makePoll(course.id);
    await enroll(student.id, course.id);
    const session = signIn(student);

    const res = await json(await submit({ pollId: poll.id, optionId: other.options[0].id }, session));
    expect(res.status).toBe(400);
    expect(await prisma.pollResponse.count({ where: { pollId: poll.id } })).toBe(0);
  });

  it("refuses a poll that is not open", async () => {
    const instructor = await makeUser("INSTRUCTOR");
    const student = await makeUser("STUDENT");
    const course = await makeCourse(instructor.id);
    const poll = await makePoll(course.id, { status: "DRAFT" });
    await enroll(student.id, course.id);
    const session = signIn(student);

    const res = await json(await submit({ pollId: poll.id, optionId: poll.options[0].id }, session));
    expect(res.status).toBe(400);
  });

  it("refuses an instructor answering their own poll", async () => {
    const { instructor, poll } = await scenario();
    const session = signIn(instructor);

    const res = await json(await submit({ pollId: poll.id, optionId: poll.options[0].id }, session));
    expect(res.status).toBe(403);
  });

  it("refuses a request with no CSRF header", async () => {
    const { student, course, poll } = await scenario();
    await enroll(student.id, course.id);
    signIn(student);

    const res = await respondPost(post("/api/polls/respond", { pollId: poll.id, optionId: poll.options[0].id }));
    expect(res.status).toBe(403);
    expect(await prisma.pollResponse.count({ where: { pollId: poll.id } })).toBe(0);
  });

  it("refuses a CSRF token minted for another session", async () => {
    const { student, course, poll } = await scenario();
    await enroll(student.id, course.id);
    const attacker = signIn(await makeUser("STUDENT"));
    signIn(student);

    const res = await respondPost(post("/api/polls/respond", { pollId: poll.id, optionId: poll.options[0].id }, attacker));
    expect(res.status).toBe(403);
  });

  it("refuses an unauthenticated request", async () => {
    const { poll } = await scenario();
    const res = await respondPost(post("/api/polls/respond", { pollId: poll.id, optionId: poll.options[0].id }));
    expect(res.status).toBe(401);
  });

  it("writes an append-only audit row alongside the response", async () => {
    const { student, course, poll } = await scenario();
    await enroll(student.id, course.id);
    const session = signIn(student);

    await submit({ pollId: poll.id, optionId: poll.options[0].id }, session);
    expect(await prisma.pollResponseLog.count({ where: { pollId: poll.id } })).toBe(1);
  });

  it("requires text for a short-answer poll", async () => {
    const instructor = await makeUser("INSTRUCTOR");
    const student = await makeUser("STUDENT");
    const course = await makeCourse(instructor.id);
    const poll = await makePoll(course.id, { type: "SHORT_ANSWER" });
    await enroll(student.id, course.id);
    const session = signIn(student);

    const blank = await json(await submit({ pollId: poll.id, shortAnswer: "   " }, session));
    expect(blank.status).toBe(400);

    const ok = await json(await submit({ pollId: poll.id, shortAnswer: "  my answer " }, session));
    expect(ok.status).toBe(201);

    const saved = await prisma.pollResponse.findFirst({ where: { pollId: poll.id } });
    expect(saved?.shortAnswer).toBe("my answer");
  });
});
