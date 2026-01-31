import { createServer } from "http";
import { Server } from "socket.io";

const port = Number(process.env.REALTIME_PORT || 4000);

const httpServer = createServer();

const io = new Server(httpServer, {
  cors: {
    origin: "*"
  }
});

type JoinPayload = {
  sessionCode: string;
  role: "INSTRUCTOR" | "STUDENT";
};

io.on("connection", (socket) => {
  socket.on("join-session", (payload: JoinPayload) => {
    const { sessionCode } = payload;
    if (!sessionCode) return;
    const room = `session:${sessionCode}`;
    socket.join(room);
    io.to(room).emit("presence-update", { count: io.sockets.adapter.rooms.get(room)?.size ?? 0 });
  });

  socket.on("leave-session", (payload: { sessionCode: string }) => {
    const room = `session:${payload.sessionCode}`;
    socket.leave(room);
    io.to(room).emit("presence-update", { count: io.sockets.adapter.rooms.get(room)?.size ?? 0 });
  });

  socket.on("poll-opened", (payload: { sessionCode: string; pollId: string }) => {
    io.to(`session:${payload.sessionCode}`).emit("poll-opened", payload);
  });

  socket.on("poll-closed", (payload: { sessionCode: string; pollId: string }) => {
    io.to(`session:${payload.sessionCode}`).emit("poll-closed", payload);
  });

  socket.on("response-submitted", (payload: { sessionCode: string; pollId: string }) => {
    io.to(`session:${payload.sessionCode}`).emit("response-submitted", payload);
  });
});

httpServer.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`MacPoll realtime server listening on port ${port}`);
});

