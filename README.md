# MacPoll

Live classroom polling for McMaster courses. Instructors build a reusable
question library, run polls during a lecture, and take attendance; students
answer on their own devices and see results update live.

## Quick start

Requires Node 20+ and a PostgreSQL 16 database (Docker provides one below).

```bash
npm install
cp .env.example .env

# Both secrets must be at least 32 characters or startup fails.
openssl rand -hex 32   # paste as SESSION_SECRET
openssl rand -hex 32   # paste as REALTIME_INTERNAL_SECRET

docker compose up -d db   # Postgres on :5432
npm run setup             # migrate + generate + seed demo data
npm run dev:all           # Next.js on :3000, realtime on :4000
```

Open http://localhost:3000. The seed creates a demo instructor and student
(addresses configurable in `.env`) sharing the `DEMO_PASSWORD` you set, plus a
course with join code `DEMO01`.

`npm run dev:all` runs **both** processes. Plain `npm run dev` starts only
Next.js, and live poll updates will not work without the realtime server.

## How it fits together

Two processes share one database and one signing secret:

- **Next.js** (`:3000`) serves the UI and the REST API.
- **Realtime server** (`server/realtime-server.ts`, `:4000`) is a Socket.IO
  server that fans events out to per-course rooms.

Clients never emit poll events. When an instructor starts a poll, the API
writes to the database and then POSTs to the realtime server's
`/internal/publish` endpoint, which is gated by `REALTIME_INTERNAL_SECRET`.
Socket handshakes require a valid signed session cookie, and joining a course
room requires enrolment. A student therefore cannot forge a poll, and events
for a course reach only that course's members.

### Request handling

Every endpoint goes through `route()` in `lib/api.ts`, which applies session
lookup, role checks, CSRF verification, rate limiting and Zod body validation
before the handler runs, so no endpoint can silently omit one. The CSRF token
is an HMAC of the session token, so a token minted for one session cannot be
replayed against another; `lib/client/api.ts` attaches it to every mutating
request.

### Data model

`Question`/`QuestionOption` form a reusable instructor-owned library. A `Poll`
is a live instance, optionally sourced from a library question and optionally
grouped into a `ClassSession`. `PollResponse` is the student's final answer,
with a unique `(studentId, pollId)` index making one-answer-per-student a
database guarantee rather than a check that can race; `PollResponseLog` is an
append-only record of every submission. Attendance is an `AttendanceSession`
with one `AttendanceRecord` per student.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev:all` | Next.js and the realtime server together |
| `npm run setup` | Apply migrations, generate the client, seed demo data |
| `npm test` | Unit and API integration tests (needs `DATABASE_URL`) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run build` | Production build |

## Tests

45 tests run against a real PostgreSQL database. Point `DATABASE_URL` at a
throwaway database and apply migrations first:

```bash
export DATABASE_URL="postgresql://macpoll:macpoll@localhost:5432/macpoll_test?schema=public"
npx prisma migrate deploy
npm test
```

They cover the invariants that matter: enrolment is required to read or answer
a poll, one answer per student, options must belong to the poll, draft polls
stay hidden from students, correct answers never reach a student, CSRF tokens
are session-bound, and CSV export neutralises formula injection.

## Configuration

See `.env.example` for the full list. `lib/env.ts` validates configuration with
Zod on first use and fails loudly; there are no insecure fallback secrets.
