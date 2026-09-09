import { createServer, IncomingMessage, ServerResponse } from "http";
import { timingSafeEqual } from "crypto";
import { parse as parseCookie } from "cookie";
import jwt from "jsonwebtoken";
import { Server, Socket } from "socket.io";
import { allowedOrigins, env } from "../lib/env";
import { prisma } from "../lib/prisma";
import { SESSION_COOKIE, type Role } from "../lib/auth";

type SocketUser = { id: string; role: Role; email: string };

// socket.data is typed as `any` by socket.io; keep our own view of it.
type AuthedSocket = Socket & { data: { user: SocketUser } };

function roomFor(courseId: string): string {
  return `course:${courseId}`;
}

function secretsMatch(provided: string | undefined): boolean {
  if (!provided) return false;
  const expected = Buffer.from(env().REALTIME_INTERNAL_SECRET, "utf8");
  const actual = Buffer.from(provided, "utf8");
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

const httpServer = createServer((req: IncomingMessage, res: ServerResponse) => {
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
    return;
  }

  // The only way an event reaches a room. Gated by a secret shared with the
  // Next.js app, so clients cannot invoke it even though the port is open.
  if (req.method === "POST" && req.url === "/internal/publish") {
    if (!secretsMatch(req.headers["x-internal-secret"] as string | undefined)) {
      res.writeHead(403, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Forbidden" }));
      return;
    }

    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) req.destroy();
    });
    req.on("end", () => {
      try {
        const { courseId, event, payload } = JSON.parse(raw) as {
          courseId: string;
          event: string;
          payload: unknown;
        };
        if (!courseId || !event) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "courseId and event are required" }));
          return;
        }
        io.to(roomFor(courseId)).emit(event, payload);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      } catch {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid JSON" }));
      }
    });
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
});

const io = new Server(httpServer, {
  cors: { origin: allowedOrigins(), credentials: true }
});

// Reject the handshake outright unless it carries a valid signed session
// cookie. Previously any client could connect anonymously.
io.use((socket, next) => {
  try {
    const header = socket.request.headers.cookie;
    if (!header) return next(new Error("unauthenticated"));

    const token = parseCookie(header)[SESSION_COOKIE];
    if (!token) return next(new Error("unauthenticated"));

    const decoded = jwt.verify(token, env().SESSION_SECRET) as jwt.JwtPayload & SocketUser;
    if (!decoded?.id || !decoded?.role) return next(new Error("unauthenticated"));

    (socket as AuthedSocket).data.user = {
      id: decoded.id,
      role: decoded.role,
      email: decoded.email
    };
    next();
  } catch {
    next(new Error("unauthenticated"));
  }
});

/** Distinct students in a room - not raw sockets, so extra tabs count once. */
async function presenceCount(courseId: string): Promise<number> {
  const sockets = await io.in(roomFor(courseId)).fetchSockets();
  const students = new Set<string>();
  for (const s of sockets) {
    const user = s.data.user as SocketUser | undefined;
    if (user && user.role === "STUDENT") students.add(user.id);
  }
  return students.size;
}

async function emitPresence(courseId: string): Promise<void> {
  io.to(roomFor(courseId)).emit("presence-update", {
    count: await presenceCount(courseId)
  });
}

io.on("connection", (socket) => {
  const user = (socket as AuthedSocket).data.user;

  // Clients may only join rooms they belong to. Note there is deliberately no
  // handler for poll-started / poll-ended / attendance-*: those originate
  // server-side via /internal/publish only.
  socket.on("join-course", async (payload: { courseId?: string }) => {
    const courseId = payload?.courseId;
    if (!courseId) return;

    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { instructorId: true }
    });
    if (!course) return;

    const permitted =
      course.instructorId === user.id ||
      user.role === "ADMIN" ||
      (await prisma.enrollment.findUnique({
        where: { studentId_courseId: { studentId: user.id, courseId } },
        select: { id: true }
      })) !== null;

    if (!permitted) return;

    await socket.join(roomFor(courseId));
    await emitPresence(courseId);
  });

  socket.on("leave-course", async (payload: { courseId?: string }) => {
    const courseId = payload?.courseId;
    if (!courseId) return;
    await socket.leave(roomFor(courseId));
    await emitPresence(courseId);
  });

  socket.on("disconnecting", () => {
    for (const room of socket.rooms) {
      if (room.startsWith("course:")) {
        const courseId = room.slice("course:".length);
        setImmediate(() => void emitPresence(courseId));
      }
    }
  });
});

const port = env().REALTIME_PORT;
httpServer.listen(port, () => {
  console.log(`MacPoll realtime server listening on port ${port}`);
});
