## MacPoll

MacPoll is a McMaster University–only live classroom polling and attendance platform inspired by iClicker, built with **Next.js 14 (App Router, TypeScript, Tailwind)**, **PostgreSQL + Prisma**, and **Socket.io** for realtime updates.

### Tech stack

- **Frontend**: Next.js 14 (App Router, TypeScript), Tailwind CSS
- **Backend**: Next.js route handlers (`app/api/*`) with Prisma
- **Database**: PostgreSQL
- **Realtime**: Socket.io (separate Node server on port 4000)
- **Auth**: Email + password (McMaster-only), simple email verification code
- **Security**: Argon2 password hashing, httpOnly cookie sessions, CSRF token, Zod validation, in-memory rate limiting, audit log for instructor actions

---

### Environment variables

Copy `.env.example` to `.env` and adjust:

```bash
DATABASE_URL="postgresql://macpoll:password@localhost:5432/macpoll?schema=public"
SESSION_SECRET="replace-with-long-random-secret"
JWT_SECRET="replace-with-long-random-jwt-secret"
NEXT_PUBLIC_REALTIME_URL="http://localhost:4000"
DEMO_INSTRUCTOR_EMAIL="demo.instructor@mcmaster.ca"
DEMO_STUDENT_EMAIL="demo.student@mcmaster.ca"
```

Notes:

- `SESSION_SECRET` must be a long random string (e.g. 64+ chars).
- `DATABASE_URL` must point to a PostgreSQL instance you control.

---

### Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Run Prisma migrations & seed**

   ```bash
   npx prisma migrate dev --name init
   npm run prisma:seed
   ```

3. **Start the realtime server**

   ```bash
   npm run realtime
   ```

   This starts the Socket.io server on `http://localhost:4000`.

4. **Start the Next.js app**

   ```bash
   npm run dev
   ```

   App runs on `http://localhost:3000`.

---

### Data model (Prisma)

Key models (simplified):

- `User(id, email, role, createdAt, verifiedAt, passwordHash)`
- `Course(id, name, term, ownerInstructorId, joinCode)`
- `Enrollment(id, courseId, userId, roleInCourse)`
- `LiveSession(id, courseId, createdBy, startedAt, endedAt, sessionCode)`
- `Poll(id, liveSessionId, type, questionText, optionsJson, isAnonymous, allowChange, timeLimitSec, openedAt, closedAt)`
- `Response(id, pollId, userId nullable, submittedAt, answerJson)`
- `Attendance(id, liveSessionId, userId, presentBool, firstJoinAt)`
- `AuditLog(id, instructorId, action, createdAt, metadata)`
- `VerificationToken` for email verification codes

The schema is defined in `prisma/schema.prisma`.

---

### Auth flow

- Registration (`/auth/register`):
  - Enforces `@mcmaster.ca` emails (via Zod).
  - Stores Argon2 password hash.
  - Creates a `VerificationToken` row with a short code (shown in UI for demo).
  - Starts a session via httpOnly cookie.
- Email verification (`/api/auth/verify-email`):
  - Confirms the verification code and sets `verifiedAt` on `User`.
- Login (`/auth/login`):
  - Verifies credentials (email + password).
  - Issues an httpOnly `macpoll_session` cookie with a signed payload.
- CSRF:
  - A CSRF token cookie is issued on login/registration and returned to the client; non-GET APIs can be extended to require `x-macpoll-csrf` header.

Sessions are stored as signed tokens in cookies (no localStorage).

---

### Courses, sessions, polling, attendance

- **Courses**
  - Instructors create courses via `/api/courses` (join code auto-generated).
  - Students join via `/api/courses/join` with the join code.
- **Live sessions**
  - Instructors start sessions per course via `/api/courses/[courseId]/sessions`.
  - Students join a live session with a session code via `/api/sessions/join`.
  - Joining a session creates an `Attendance` row (not yet marked present).
- **Polling**
  - Instructors create polls via `/api/polls` while in a live session.
  - Polls support MC, True/False, short answer, numeric.
  - Students submit responses via `/api/responses`.
  - Attendance is marked present after at least one response in the session.
  - Instructor view fetches live aggregates via `/api/instructor/session/[sessionId]/results`.
- **Attendance export**
  - `/api/attendance/export?liveSessionId=...` returns a CSV with attendance + basic poll stats.

---

### Realtime (Socket.io)

`server/realtime-server.ts` exposes a Socket.io server that:

- Supports `join-session` / `leave-session` events by `sessionCode`.
- Broadcasts:
  - `presence-update` with the current connected count.
  - `poll-opened`, `poll-closed`, and `response-submitted` events to all clients in a session room.

The frontend connects using `NEXT_PUBLIC_REALTIME_URL`.

---

### UI overview

- `Home` (`/`):
  - Landing page with instructor/student entry points.
- `Auth`:
  - `/auth/register`: McMaster-only register + verification code.
  - `/auth/login`: login with email/password.
- `Dashboard` (`/dashboard`):
  - Instructors: create courses, view join codes, start sessions, navigate to live instructor view.
  - Students: join courses via join code, navigate to student join/session views.
- `Instructor live session` (`/instructor/session/[sessionId]`):
  - Shows course + session code.
  - Lets instructors create/launch polls.
  - Shows live bar-chart–style aggregates.
  - Shows connected student count.
- `Student live session` (`/student/session/[sessionId]`):
  - Mobile-first single column UI: shows current poll, quick tap options for MC/True-False, minimal text input for text/numeric.
  - Shows clear states: waiting for poll, poll active, submitted.

Colours use McMaster branding:

- Maroon: `#7A003C`
- Gold: `#FDBF57`

Accessibility:

- Keyboard-focusable controls, visible focus outlines, high-contrast text on buttons.

---

### Demo data & accounts

`prisma/seed.ts` creates:

- **Demo instructor**
  - Email: value of `DEMO_INSTRUCTOR_EMAIL` (default: `demo.instructor@mcmaster.ca`)
  - Password: `password123`
- **Demo student**
  - Email: value of `DEMO_STUDENT_EMAIL` (default: `demo.student@mcmaster.ca`)
  - Password: `password123`
- A demo course (`COMP SCI 1JC3`, Winter 2026) with:
  - Join code: `MAC123`
  - One demo live session: session code `DEMO01`
  - One demo multiple-choice poll.

---

### Running a demo lecture (2 browser windows)

1. **Start services**
   - Ensure PostgreSQL is running and `.env` is configured.
   - Run migrations and seed (once): `npx prisma migrate dev && npm run prisma:seed`
   - Start realtime server: `npm run realtime`
   - Start Next app: `npm run dev`

2. **Open two browsers / profiles**
   - **Window A (Instructor)**:
     - Go to `http://localhost:3000/auth/login`
     - Log in with demo instructor (e.g. `demo.instructor@mcmaster.ca` / `password123`).
     - Go to `Dashboard`, open the existing demo course and session, or create a new one.
     - Click “Start session” then “Open dashboard” to view `/instructor/session/[sessionId]`.
   - **Window B (Student)**:
     - Go to `http://localhost:3000/auth/login`
     - Log in with demo student (e.g. `demo.student@mcmaster.ca` / `password123`).
     - From dashboard, join the demo course using `MAC123` if needed.
     - Navigate to `Join live session`, enter the visible `sessionCode` (e.g. `DEMO01`), and you’ll be redirected to `/student/session/[sessionId]`.

3. **Simulate a live poll**
   - In the instructor window, create a multiple-choice question and click **Launch poll**.
   - The student window should show the active poll; tap to answer, then submit.
   - Watch the instructor’s “Live results” section update in realtime as responses come in.
   - Export attendance and results with the “Export CSV” link in the instructor dashboard.

---

### Notes & extensions

- For production, you should:
  - Back the realtime server and Next.js app with proper TLS and CORS config.
  - Replace the demo verification code display with a real email provider.
  - Persist rate-limit buckets in Redis or similar.
  - Harden CSRF enforcement on all non-GET endpoints that mutate state.
- The codebase is structured for readability and extension:
  - `app/api/*`: typed route handlers with Zod validation and strict authorization checks.
  - `lib/*`: auth, validation, prisma client, permissions, and rate limiting helpers.
  - `app/*`: App Router pages for auth, dashboards, and session views.

