import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import {
  prisma,
  buildRequest,
  readJson,
  createUser,
  createCourse,
  createSession,
  createPoll,
  enroll,
  resetDatabase,
  type TestUser
} from "./helpers";

import { POST as submitResponse } from "@/app/api/responses/route";
import { POST as createPollRoute, PATCH as updatePoll } from "@/app/api/polls/route";
import { POST as joinSession } from "@/app/api/sessions/join/route";
import { POST as joinCourse } from "@/app/api/courses/join/route";
import { GET as getResults } from "@/app/api/instructor/session/[sessionId]/results/route";
import { GET as getStudentSession } from "@/app/api/student/session/[sessionId]/route";
import { POST as endSession } from "@/app/api/instructor/session/[sessionId]/end/route";
import { GET as exportCsv } from "@/app/api/attendance/export/route";
import { GET as getRoster } from "@/app/api/instructor/session/[sessionId]/attendance/route";

// The realtime server is not running in tests; publish() would otherwise spend
// its timeout on every mutating call.
beforeAll(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({ delivered: true }), { status: 200 }))
  );
});

afterAll(async () => {
  vi.unstubAllGlobals();
  await prisma.$disconnect();
});

let instructor: TestUser;
let student: TestUser;
let outsider: TestUser;
let course: Awaited<ReturnType<typeof createCourse>>;
let session: Awaited<ReturnType<typeof createSession>>;

beforeEach(async () => {
  await resetDatabase();
  instructor = await createUser("INSTRUCTOR");
  student = await createUser("STUDENT");
  outsider = await createUser("STUDENT");
  course = await createCourse(instructor);
  session = await createSession(course, instructor);
  await enroll(course, student);
});

describe("POST /api/responses", () => {
  it("rejects a student who is not enrolled in the course", async () => {
    const poll = await createPoll(session);

    const { status, body } = await readJson(
      await submitResponse(
        buildRequest("/api/responses", {
          method: "POST",
          user: outsider,
          body: { pollId: poll.id, answer: "A" }
        })
      )
    );

    expect(status).toBe(403);
    expect(body.error).toMatch(/not enrolled/i);
    expect(await prisma.response.count()).toBe(0);
  });

  it("accepts an enrolled student and marks them present", async () => {
    const poll = await createPoll(session);

    const { status } = await readJson(
      await submitResponse(
        buildRequest("/api/responses", {
          method: "POST",
          user: student,
          body: { pollId: poll.id, answer: "A" }
        })
      )
    );

    expect(status).toBe(201);

    const attendance = await prisma.attendance.findUnique({
      where: { liveSessionId_userId: { liveSessionId: session.id, userId: student.id } }
    });
    expect(attendance?.presentBool).toBe(true);
  });

  // Previously each submit inserted a new row, so one student could inflate
  // the tally without limit.
  it("keeps one response per student when the answer changes", async () => {
    const poll = await createPoll(session, { allowChange: true });

    for (const answer of ["A", "B", "A"]) {
      const response = await submitResponse(
        buildRequest("/api/responses", {
          method: "POST",
          user: student,
          body: { pollId: poll.id, answer }
        })
      );
      expect(response.status).toBe(201);
    }

    const responses = await prisma.response.findMany({ where: { pollId: poll.id } });
    expect(responses).toHaveLength(1);
    expect(responses[0]!.answerJson).toBe("A");
  });

  it("refuses a second answer when the poll disallows changes", async () => {
    const poll = await createPoll(session, { allowChange: false });
    const request = () =>
      submitResponse(
        buildRequest("/api/responses", {
          method: "POST",
          user: student,
          body: { pollId: poll.id, answer: "A" }
        })
      );

    expect((await request()).status).toBe(201);
    const { status, body } = await readJson(await request());

    expect(status).toBe(409);
    expect(body.error).toMatch(/already answered/i);
  });

  it("rejects an option that is not on the poll", async () => {
    const poll = await createPoll(session);

    const { status } = await readJson(
      await submitResponse(
        buildRequest("/api/responses", {
          method: "POST",
          user: student,
          body: { pollId: poll.id, answer: "NOT_AN_OPTION" }
        })
      )
    );

    expect(status).toBe(400);
    expect(await prisma.response.count()).toBe(0);
  });

  it("rejects a non-numeric answer to a numeric poll", async () => {
    const poll = await createPoll(session, { type: "NUMERIC", optionsJson: undefined });

    const { status } = await readJson(
      await submitResponse(
        buildRequest("/api/responses", {
          method: "POST",
          user: student,
          body: { pollId: poll.id, answer: "twelve" }
        })
      )
    );

    expect(status).toBe(400);
  });

  it("stops the instructor answering their own poll", async () => {
    const poll = await createPoll(session);

    const { status } = await readJson(
      await submitResponse(
        buildRequest("/api/responses", {
          method: "POST",
          user: instructor,
          body: { pollId: poll.id, answer: "A" }
        })
      )
    );

    expect(status).toBe(403);
  });

  it("rejects responses to a closed poll", async () => {
    const poll = await createPoll(session, { closedAt: new Date() });

    const { status } = await readJson(
      await submitResponse(
        buildRequest("/api/responses", {
          method: "POST",
          user: student,
          body: { pollId: poll.id, answer: "A" }
        })
      )
    );

    expect(status).toBe(400);
  });

  it("rejects responses after the time limit has passed", async () => {
    const poll = await createPoll(session, {
      timeLimitSec: 30,
      openedAt: new Date(Date.now() - 60_000)
    });

    const { status, body } = await readJson(
      await submitResponse(
        buildRequest("/api/responses", {
          method: "POST",
          user: student,
          body: { pollId: poll.id, answer: "A" }
        })
      )
    );

    expect(status).toBe(400);
    expect(body.error).toMatch(/time is up/i);
  });

  it("requires authentication", async () => {
    const poll = await createPoll(session);
    const { status } = await readJson(
      await submitResponse(
        buildRequest("/api/responses", {
          method: "POST",
          user: null,
          body: { pollId: poll.id, answer: "A" }
        })
      )
    );
    expect(status).toBe(401);
  });

  // CSRF tokens were issued but never checked before.
  it("rejects a mutation without the CSRF header", async () => {
    const poll = await createPoll(session);
    const { status, body } = await readJson(
      await submitResponse(
        buildRequest("/api/responses", {
          method: "POST",
          user: student,
          csrf: false,
          body: { pollId: poll.id, answer: "A" }
        })
      )
    );

    expect(status).toBe(403);
    expect(body.error).toMatch(/csrf/i);
  });
});

describe("POST /api/polls", () => {
  it("closes the previously open poll when a new one launches", async () => {
    const first = await createPoll(session);

    const { status } = await readJson(
      await createPollRoute(
        buildRequest("/api/polls", {
          method: "POST",
          user: instructor,
          body: {
            liveSessionId: session.id,
            type: "TRUE_FALSE",
            questionText: "Is this closed?"
          }
        })
      )
    );

    expect(status).toBe(201);
    const reloaded = await prisma.poll.findUnique({ where: { id: first.id } });
    expect(reloaded?.closedAt).not.toBeNull();

    const open = await prisma.poll.findMany({
      where: { liveSessionId: session.id, closedAt: null }
    });
    expect(open).toHaveLength(1);
  });

  it("rejects a multiple choice poll with fewer than two options", async () => {
    const { status, body } = await readJson(
      await createPollRoute(
        buildRequest("/api/polls", {
          method: "POST",
          user: instructor,
          body: {
            liveSessionId: session.id,
            type: "MULTIPLE_CHOICE",
            questionText: "Only one?",
            options: ["A"]
          }
        })
      )
    );

    expect(status).toBe(400);
    expect(body.error).toMatch(/at least 2 options/i);
  });

  it("rejects duplicate options", async () => {
    const { status } = await readJson(
      await createPollRoute(
        buildRequest("/api/polls", {
          method: "POST",
          user: instructor,
          body: {
            liveSessionId: session.id,
            type: "MULTIPLE_CHOICE",
            questionText: "Duplicates?",
            options: ["A", "A"]
          }
        })
      )
    );

    expect(status).toBe(400);
  });

  it("stops a student creating a poll", async () => {
    const { status } = await readJson(
      await createPollRoute(
        buildRequest("/api/polls", {
          method: "POST",
          user: student,
          body: {
            liveSessionId: session.id,
            type: "TRUE_FALSE",
            questionText: "Should not work"
          }
        })
      )
    );

    expect(status).toBe(403);
  });

  it("stops another instructor creating a poll in this session", async () => {
    const other = await createUser("INSTRUCTOR");
    const { status } = await readJson(
      await createPollRoute(
        buildRequest("/api/polls", {
          method: "POST",
          user: other,
          body: {
            liveSessionId: session.id,
            type: "TRUE_FALSE",
            questionText: "Not my course"
          }
        })
      )
    );

    expect(status).toBe(403);
  });

  it("closes a poll on PATCH", async () => {
    const poll = await createPoll(session);

    const { status } = await readJson(
      await updatePoll(
        buildRequest("/api/polls", {
          method: "PATCH",
          user: instructor,
          body: { pollId: poll.id, close: true }
        })
      )
    );

    expect(status).toBe(200);
    expect((await prisma.poll.findUnique({ where: { id: poll.id } }))?.closedAt).not.toBeNull();
  });
});

describe("session access", () => {
  it("enrolls a student who joins with a valid session code", async () => {
    const { status } = await readJson(
      await joinSession(
        buildRequest("/api/sessions/join", {
          method: "POST",
          user: outsider,
          body: { sessionCode: session.sessionCode }
        })
      )
    );

    expect(status).toBe(200);

    const enrollment = await prisma.enrollment.findUnique({
      where: { courseId_userId: { courseId: course.id, userId: outsider.id } }
    });
    expect(enrollment).not.toBeNull();

    // The old flow created attendance without enrolling, so this page 403'd.
    const view = await readJson(
      await getStudentSession(
        buildRequest(`/api/student/session/${session.id}`, { user: outsider }),
        { params: { sessionId: session.id } }
      )
    );
    expect(view.status).toBe(200);
  });

  it("refuses a session code that has ended", async () => {
    await prisma.liveSession.update({
      where: { id: session.id },
      data: { endedAt: new Date() }
    });

    const { status } = await readJson(
      await joinSession(
        buildRequest("/api/sessions/join", {
          method: "POST",
          user: outsider,
          body: { sessionCode: session.sessionCode }
        })
      )
    );

    expect(status).toBe(400);
  });

  it("refuses an unknown session code", async () => {
    const { status } = await readJson(
      await joinSession(
        buildRequest("/api/sessions/join", {
          method: "POST",
          user: outsider,
          body: { sessionCode: "ZZZZZZ" }
        })
      )
    );
    expect(status).toBe(404);
  });

  it("blocks a non-enrolled student from reading the session", async () => {
    const { status } = await readJson(
      await getStudentSession(
        buildRequest(`/api/student/session/${session.id}`, { user: outsider }),
        { params: { sessionId: session.id } }
      )
    );
    expect(status).toBe(403);
  });

  it("enrolls a student joining by course code", async () => {
    const { status } = await readJson(
      await joinCourse(
        buildRequest("/api/courses/join", {
          method: "POST",
          user: outsider,
          body: { joinCode: course.joinCode }
        })
      )
    );

    expect(status).toBe(201);
  });

  it("is idempotent when joining a course twice", async () => {
    const request = () =>
      joinCourse(
        buildRequest("/api/courses/join", {
          method: "POST",
          user: outsider,
          body: { joinCode: course.joinCode }
        })
      );

    expect((await request()).status).toBe(201);
    expect((await request()).status).toBe(200);
    expect(await prisma.enrollment.count({ where: { userId: outsider.id } })).toBe(1);
  });
});

describe("instructor results", () => {
  it("aggregates responses with percentages", async () => {
    const poll = await createPoll(session);
    const second = await createUser("STUDENT");
    await enroll(course, second);

    for (const [user, answer] of [
      [student, "A"],
      [second, "B"]
    ] as const) {
      await submitResponse(
        buildRequest("/api/responses", {
          method: "POST",
          user,
          body: { pollId: poll.id, answer }
        })
      );
    }

    const { status, body } = await readJson(
      await getResults(
        buildRequest(`/api/instructor/session/${session.id}/results`, { user: instructor }),
        { params: { sessionId: session.id } }
      )
    );

    expect(status).toBe(200);
    expect(body.current.total).toBe(2);
    expect(body.current.tallies).toEqual([
      { label: "A", count: 1, percent: 50 },
      { label: "B", count: 1, percent: 50 }
    ]);
    expect(body.attendance.present).toBe(2);
  });

  it("hides results from a different instructor", async () => {
    const other = await createUser("INSTRUCTOR");
    const { status } = await readJson(
      await getResults(
        buildRequest(`/api/instructor/session/${session.id}/results`, { user: other }),
        { params: { sessionId: session.id } }
      )
    );
    expect(status).toBe(403);
  });

  it("hides results from students", async () => {
    const { status } = await readJson(
      await getResults(
        buildRequest(`/api/instructor/session/${session.id}/results`, { user: student }),
        { params: { sessionId: session.id } }
      )
    );
    expect(status).toBe(403);
  });
});

describe("ending a session", () => {
  it("closes open polls and blocks further responses", async () => {
    const poll = await createPoll(session);

    const { status } = await readJson(
      await endSession(
        buildRequest(`/api/instructor/session/${session.id}/end`, {
          method: "POST",
          user: instructor
        }),
        { params: { sessionId: session.id } }
      )
    );
    expect(status).toBe(200);

    expect((await prisma.poll.findUnique({ where: { id: poll.id } }))?.closedAt).not.toBeNull();

    const attempt = await readJson(
      await submitResponse(
        buildRequest("/api/responses", {
          method: "POST",
          user: student,
          body: { pollId: poll.id, answer: "A" }
        })
      )
    );
    expect(attempt.status).toBe(400);
  });

  it("refuses to end a session twice", async () => {
    const end = () =>
      endSession(
        buildRequest(`/api/instructor/session/${session.id}/end`, {
          method: "POST",
          user: instructor
        }),
        { params: { sessionId: session.id } }
      );

    expect((await end()).status).toBe(200);
    expect((await end()).status).toBe(400);
  });
});

describe("CSV export", () => {
  it("includes the roster and neutralizes formula injection", async () => {
    const sneaky = await prisma.user.create({
      data: { email: "=cmd|calc@mcmaster.ca", role: "STUDENT", verifiedAt: new Date() }
    });
    await enroll(course, sneaky);

    const poll = await createPoll(session);
    await submitResponse(
      buildRequest("/api/responses", {
        method: "POST",
        user: student,
        body: { pollId: poll.id, answer: "A" }
      })
    );

    const response = await exportCsv(
      buildRequest(`/api/attendance/export?liveSessionId=${session.id}`, { user: instructor })
    );
    const csv = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/csv");
    expect(csv).toContain(student.email);
    expect(csv).toContain("'=cmd|calc@mcmaster.ca");
    expect(csv).not.toMatch(/^=cmd/m);
  });

  it("refuses an export from another instructor", async () => {
    const other = await createUser("INSTRUCTOR");
    const response = await exportCsv(
      buildRequest(`/api/attendance/export?liveSessionId=${session.id}`, { user: other })
    );
    expect(response.status).toBe(403);
  });
});

describe("anonymous polls", () => {
  it("lets a student answer an anonymous poll after answering an earlier poll", async () => {
    const first = await createPoll(session);
    await submitResponse(
      buildRequest("/api/responses", {
        method: "POST",
        user: student,
        body: { pollId: first.id, answer: "A" }
      })
    );

    const anon = await createPoll(session, { isAnonymous: true, allowChange: false });
    const { status, body } = await readJson(
      await submitResponse(
        buildRequest("/api/responses", {
          method: "POST",
          user: student,
          body: { pollId: anon.id, answer: "A" }
        })
      )
    );

    expect(status).toBe(201);
    expect(body.error).toBeUndefined();
  });

  it("stores no userId and blocks a second anonymous answer", async () => {
    const anon = await createPoll(session, { isAnonymous: true });
    const send = () =>
      submitResponse(
        buildRequest("/api/responses", {
          method: "POST",
          user: student,
          body: { pollId: anon.id, answer: "A" }
        })
      );

    expect((await send()).status).toBe(201);
    expect((await send()).status).toBe(409);

    const rows = await prisma.response.findMany({ where: { pollId: anon.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.userId).toBeNull();
  });

  it("survives concurrent submissions from one student", async () => {
    const anon = await createPoll(session, { isAnonymous: true });

    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        submitResponse(
          buildRequest("/api/responses", {
            method: "POST",
            user: student,
            body: { pollId: anon.id, answer: "A" }
          })
        )
      )
    );

    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(await prisma.response.count({ where: { pollId: anon.id } })).toBe(1);
  });

  it("counts anonymous participation on the roster", async () => {
    const anon = await createPoll(session, { isAnonymous: true });
    await submitResponse(
      buildRequest("/api/responses", {
        method: "POST",
        user: student,
        body: { pollId: anon.id, answer: "A" }
      })
    );

    const { body } = await readJson(
      await getRoster(
        buildRequest(`/api/instructor/session/${session.id}/attendance`, { user: instructor }),
        { params: { sessionId: session.id } }
      )
    );

    const row = body.roster.find((r: { email: string }) => r.email === student.email);
    expect(row.answered).toBe(1);
    expect(row.present).toBe(true);
  });
});

describe("reopening a poll", () => {
  it("closes any other open poll so only one is live", async () => {
    const first = await createPoll(session);
    await updatePoll(
      buildRequest("/api/polls", {
        method: "PATCH",
        user: instructor,
        body: { pollId: first.id, close: true }
      })
    );

    const second = await createPoll(session);

    const { status } = await readJson(
      await updatePoll(
        buildRequest("/api/polls", {
          method: "PATCH",
          user: instructor,
          body: { pollId: first.id, close: false }
        })
      )
    );
    expect(status).toBe(200);

    const open = await prisma.poll.findMany({
      where: { liveSessionId: session.id, openedAt: { not: null }, closedAt: null }
    });
    expect(open).toHaveLength(1);
    expect(open[0]!.id).toBe(first.id);
    expect((await prisma.poll.findUnique({ where: { id: second.id } }))?.closedAt).not.toBeNull();
  });
});
