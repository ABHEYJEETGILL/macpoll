import { createServer, IncomingMessage, ServerResponse } from "http";
import { Server, Socket } from "socket.io";
import { config as loadEnv } from "dotenv";
import {
  verifySessionToken,
  readCookie,
  SESSION_COOKIE,
  safeEqual
} from "../lib/session-token";
import { env, allowedOrigins } from "../lib/env";

loadEnv();

const { REALTIME_PORT, REALTIME_INTERNAL_SECRET } = env();
const origins = allowedOrigins();

type SocketUser = { userId: string; role: "INSTRUCTOR" | "STUDENT" };

/**
 * Rooms are keyed by session code. Presence is tracked per user rather than
 * per socket so a student with two tabs open counts once, and instructors are
 * excluded from the student headcount.
 */
const roomMembers = new Map<string, Map<string, Set<string>>>();

function room(sessionCode: string): string {
  return `session:${sessionCode}`;
}

function studentCount(sessionCode: string): number {
  const members = roomMembers.get(sessionCode);
  if (!members) return 0;
  return members.size;
}

function addMember(sessionCode: string, userId: string, socketId: string): void {
  let members = roomMembers.get(sessionCode);
  if (!members) {
    members = new Map();
    roomMembers.set(sessionCode, members);
  }
  const sockets = members.get(userId) ?? new Set<string>();
  sockets.add(socketId);
  members.set(userId, sockets);
}

function removeMember(sessionCode: string, userId: string, socketId: string): void {
  const members = roomMembers.get(sessionCode);
  if (!members) return;

  const sockets = members.get(userId);
  if (!sockets) return;

  sockets.delete(socketId);
  if (sockets.size === 0) members.delete(userId);
  if (members.size === 0) roomMembers.delete(sessionCode);
}

const httpServer = createServer(handleHttpRequest);

const io = new Server(httpServer, {
  cors: { origin: origins, credentials: true },
  // Cookies ride the handshake, so the browser must be allowed to send them.
  transports: ["websocket", "polling"]
});

/**
 * Every socket must present a valid signed session cookie. The old server
 * accepted any connection and rebroadcast whatever a client emitted, which let
 * a student forge poll-opened events for the whole lecture hall.
 */
io.use((socket, next) => {
  const token = readCookie(socket.handshake.headers.cookie ?? "", SESSION_COOKIE);
  const session = token ? verifySessionToken(token) : null;

  if (!session) {
    next(new Error("unauthorized"));
    return;
  }

  socket.data.user = { userId: session.userId, role: session.role } satisfies SocketUser;
  next();
});

io.on("connection", (socket: Socket) => {
  const user = socket.data.user as SocketUser;

  socket.on("join-session", (payload: { sessionCode?: string }) => {
    const sessionCode = payload?.sessionCode;
    if (typeof sessionCode !== "string" || sessionCode.length === 0) return;

    socket.join(room(sessionCode));
    socket.data.sessionCode = sessionCode;

    if (user.role === "STUDENT") {
      addMember(sessionCode, user.userId, socket.id);
    }
    io.to(room(sessionCode)).emit("presence-update", { count: studentCount(sessionCode) });
  });

  socket.on("leave-session", (payload: { sessionCode?: string }) => {
    const sessionCode = payload?.sessionCode ?? socket.data.sessionCode;
    if (typeof sessionCode !== "string") return;

    socket.leave(room(sessionCode));
    removeMember(sessionCode, user.userId, socket.id);
    io.to(room(sessionCode)).emit("presence-update", { count: studentCount(sessionCode) });
  });

  socket.on("disconnect", () => {
    const sessionCode = socket.data.sessionCode;
    if (typeof sessionCode !== "string") return;

    removeMember(sessionCode, user.userId, socket.id);
    io.to(room(sessionCode)).emit("presence-update", { count: studentCount(sessionCode) });
  });
});

/**
 * Internal publish endpoint. Only the Next.js app knows the shared secret, so
 * poll lifecycle events can only originate server-side.
 */
function handleHttpRequest(req: IncomingMessage, res: ServerResponse): void {
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", rooms: roomMembers.size }));
    return;
  }

  if (req.method !== "POST" || req.url !== "/internal/broadcast") {
    res.writeHead(404).end();
    return;
  }

  const provided = req.headers["x-macpoll-internal-secret"];
  if (typeof provided !== "string" || !safeEqual(provided, REALTIME_INTERNAL_SECRET)) {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "unauthorized" }));
    return;
  }

  let body = "";
  req.on("data", (chunk) => {
    body += chunk;
    // Broadcast payloads are tiny; refuse anything that is not.
    if (body.length > 16_384) req.destroy();
  });

  req.on("end", () => {
    try {
      const { sessionCode, event } = JSON.parse(body) as {
        sessionCode?: string;
        event?: { type?: string };
      };

      if (typeof sessionCode !== "string" || !event?.type) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "invalid payload" }));
        return;
      }

      io.to(room(sessionCode)).emit(event.type, event);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ delivered: true }));
    } catch {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "invalid json" }));
    }
  });
}

httpServer.listen(REALTIME_PORT, () => {
  console.log(`MacPoll realtime server listening on port ${REALTIME_PORT}`);
  console.log(`Accepting websocket origins: ${origins.join(", ")}`);
});

function shutdown(signal: string): void {
  console.log(`${signal} received, shutting down realtime server`);
  io.close(() => httpServer.close(() => process.exit(0)));
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
