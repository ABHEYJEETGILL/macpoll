# MacPoll

Live classroom polling and attendance for McMaster University — an iClicker
alternative with no hardware remotes and no per-student licence.

Built with **Next.js 14** (App Router, TypeScript), **PostgreSQL + Prisma**, and
a **Socket.io** server for realtime updates.

---

## Quick start

```bash
# 1. Dependencies
npm install

# 2. Database (or point DATABASE_URL at your own PostgreSQL)
docker compose up -d db

# 3. Configuration
cp .env.example .env
#    then fill in the two secrets:
#    openssl rand -hex 32   -> SESSION_SECRET
#    openssl rand -hex 32   -> REALTIME_INTERNAL_SECRET

# 4. Schema + demo data
npm run setup

# 5. Run the app and the realtime server together
npm run dev:all
```

Open <http://localhost:3000>. The realtime server listens on port 4000.

If you prefer two terminals, run `npm run dev` and `npm run realtime` separately.

### Demo accounts

`npm run setup` seeds a ready-to-use lecture:

| Role       | Email                          | Password      |
| ---------- | ------------------------------ | ------------- |
| Instructor | `demo.instructor@mcmaster.ca`  | `password123` |
| Student    | `demo.student@mcmaster.ca`     | `password123` |

Plus three extra students so the roster and charts have data. The demo course
**COMP SCI 1JC3** uses join code `MAC123` and has a live session with code
`DEMO01` — one open poll and one closed poll with responses already recorded.

Seeding is idempotent, so `npm run prisma:seed` can be re-run at any time. It
refuses to run when `NODE_ENV=production`.

---

## Try it in two windows

1. **Window A — instructor.** Log in as the demo instructor, open the dashboard,
   press **Sessions** on the demo course, then **Open**. The session code is
   shown in large type at the top.
2. **Window B — student** (use a private window so the cookies do not collide).
   Log in as the demo student and go to **Join a session**. Enter the code.
3. Launch a poll from window A. It appears in window B immediately; answers push
   back and the bars move as they arrive.
4. Press **Close poll**, then **End session**, then **Export CSV** for the
   attendance and results file.

---

## Scripts

| Command                 | What it does                                       |
| ----------------------- | -------------------------------------------------- |
| `npm run dev`           | Next.js dev server on :3000                        |
| `npm run realtime`      | Socket.io server on :4000                          |
| `npm run dev:all`       | Both of the above, in one terminal                 |
| `npm run setup`         | Migrate, generate the client, and seed             |
| `npm test`              | Vitest unit + API integration suite                |
| `npm run typecheck`     | `tsc --noEmit`                                     |
| `npm run lint`          | ESLint via `next lint`                             |
| `npm run build`         | Production build                                   |
| `npm run prisma:studio` | Browse the database                                |

Tests need a database. They use `TEST_DATABASE_URL` when set (see `.env.test`)
and otherwise fall back to `DATABASE_URL`. **They truncate every table**, so
point them at a scratch database, not your dev one:

```bash
createdb macpoll_test
echo 'TEST_DATABASE_URL="postgresql://macpoll:macpoll@localhost:5432/macpoll_test?schema=public"' > .env.test
DATABASE_URL="$TEST_DATABASE_URL" npx prisma migrate deploy
npm test
```

---

## Environment variables

| Variable                     | Required | Purpose                                                  |
| ---------------------------- | -------- | -------------------------------------------------------- |
| `DATABASE_URL`               | yes      | PostgreSQL connection string                             |
| `SESSION_SECRET`             | yes      | Signs session cookies. 32+ chars. Rotating logs everyone out. |
| `REALTIME_INTERNAL_SECRET`   | yes      | Shared by the app and realtime server. 32+ chars. Must match. |
| `NEXT_PUBLIC_REALTIME_URL`   | yes      | Websocket URL the **browser** connects to                |
| `REALTIME_INTERNAL_URL`      | no       | URL the **Next server** publishes events to (default `http://localhost:4000`) |
| `REALTIME_ALLOWED_ORIGINS`   | no       | Comma-separated websocket CORS allowlist                 |
| `REALTIME_PORT`              | no       | Realtime server port (default `4000`)                    |
| `DEMO_*`                     | no       | Seed accounts and password                               |

Configuration is validated by Zod at first use (`lib/env.ts`); a missing or
too-short secret fails immediately with a message naming the variable rather
than surfacing later as a confusing runtime error.

---

## Architecture

```
Browser ──HTTP──► Next.js route handlers ──► Prisma ──► PostgreSQL
   │                        │
   │                        └── publish() ──► Socket.io server
   └────────── websocket ──────────────────────────┘
```

Poll events originate **server-side**. When an instructor launches or closes a
poll, the route handler writes to the database and then calls the realtime
server's internal `/internal/broadcast` endpoint, authenticated with
`REALTIME_INTERNAL_SECRET`. Browsers only ever *receive* those events; a client
cannot announce that a poll opened.

Websocket connections must present a valid signed session cookie during the
handshake. If the realtime server is unreachable, both session pages fall back
to polling every five seconds, so a lecture degrades rather than breaking.

### Layout

```
app/api/*     Route handlers (thin: auth, validate, delegate)
lib/api.ts    Route wrapper — session, role, CSRF, rate limit, validation
lib/auth.ts   Password hashing and cookie helpers (server-only)
lib/session-token.ts  Token signing/verification, shared with the realtime server
lib/answers.ts        Answer validation and tallying
lib/permissions.ts    Ownership and enrollment checks
server/       Socket.io server
tests/        Vitest unit and API integration tests
```

Every route is declared through `route()` in `lib/api.ts`, which applies the
session lookup, role requirement, CSRF check, rate limit and body schema before
the handler runs — so a new endpoint cannot forget one of them.

---

## Security notes

- **Passwords** hashed with Argon2id. Login compares against a dummy hash on
  unknown emails so response timing does not reveal which accounts exist.
- **Sessions** are HMAC-SHA256 signed tokens in an `httpOnly`, `SameSite=Lax`
  cookie with a 12 hour expiry embedded in the payload (not just the cookie).
- **CSRF**: double-submit token; every mutating, authenticated route requires the
  `x-macpoll-csrf` header to match the cookie.
- **Authorization** is checked per request: instructors only reach courses they
  own, students only reach courses they are enrolled in.
- **Vote integrity**: a unique `(pollId, userId)` index makes one response per
  student per poll a database guarantee, not an application convention.
  Submitting again updates the existing row when the poll allows changes.
- **Answers** are validated against the poll's type and option list server-side.
- **CSV export** escapes quotes and neutralizes leading `=`, `+`, `-` and `@` so
  a crafted email address cannot execute as a spreadsheet formula.
- **Codes** use `crypto.randomBytes` over an alphabet with no `O/0`, `I/1` or
  `S/5`, and retry on collision.

Middleware redirects signed-out visitors away from app pages, but it only checks
that a cookie is present — it runs on the edge runtime without `node:crypto`.
The real boundary is the per-route verification described above.

### Before deploying

- Replace the on-screen verification code with a real email provider
  (`app/api/auth/register/route.ts`). The code is already withheld from the API
  response when `NODE_ENV=production`.
- Move rate limiting to Redis; buckets are currently per-process (`lib/rateLimit.ts`).
- Serve both processes over TLS and set `REALTIME_ALLOWED_ORIGINS` to your real
  origin.
- Email verification is recorded but not yet enforced — decide whether unverified
  accounts should be able to join sessions.

---

## Data model

- `User` — email (McMaster-only), Argon2 hash, role, verification timestamp
- `Course` — owned by an instructor, unique join code
- `Enrollment` — unique per (course, user)
- `LiveSession` — unique session code, `endedAt` marks it finished
- `Poll` — type, question, options, anonymity, change policy, optional time limit
- `Response` — **unique per (poll, user)**; anonymous polls store a null user
- `PollParticipation` — unique per (poll, user); records *that* someone answered
  without recording *what* they answered
- `Attendance` — unique per (session, user); `presentBool` set on first answer
- `AuditLog` — instructor actions (course/session/poll lifecycle)
- `VerificationToken` — email verification codes

Anonymous polls deliberately store no `userId` on the response. Postgres treats
NULLs as distinct, so the unique index still permits many anonymous rows;
`PollParticipation` is what prevents one student submitting twice, and it is
also the source for "answers given" counts on the roster and in the CSV.

---

## Health checks

- `GET /api/health` — app and database
- `GET :4000/health` — realtime server and active room count
