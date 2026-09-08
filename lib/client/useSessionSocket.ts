"use client";

import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";

export type SessionEvent =
  | { type: "poll-opened"; pollId: string }
  | { type: "poll-closed"; pollId: string }
  | { type: "response-submitted"; pollId: string; total: number }
  | { type: "session-ended" };

type Options = {
  sessionCode: string | null;
  onEvent: (event: SessionEvent) => void;
};

const EVENT_NAMES = ["poll-opened", "poll-closed", "response-submitted", "session-ended"] as const;

/**
 * Owns one Socket.io connection per mounted session view.
 *
 * The previous implementation kept the socket in a module-level variable and
 * registered handlers only on first connect, so navigating between sessions
 * reused listeners bound to the first session's stale state. Here the socket
 * lives with the component and the callback is read through a ref, so handlers
 * always see current state without re-subscribing.
 */
export function useSessionSocket({ sessionCode, onEvent }: Options) {
  const [connected, setConnected] = useState(false);
  const [presence, setPresence] = useState(0);
  const onEventRef = useRef(onEvent);

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    if (!sessionCode) return;

    const socket: Socket = io(process.env.NEXT_PUBLIC_REALTIME_URL || "http://localhost:4000", {
      withCredentials: true,
      transports: ["websocket", "polling"],
      reconnectionDelay: 500,
      reconnectionDelayMax: 4000
    });

    socket.on("connect", () => {
      setConnected(true);
      socket.emit("join-session", { sessionCode });
    });
    socket.on("disconnect", () => setConnected(false));
    socket.on("connect_error", () => setConnected(false));
    socket.on("presence-update", (payload: { count?: number }) => {
      setPresence(payload?.count ?? 0);
    });

    for (const name of EVENT_NAMES) {
      socket.on(name, (payload: Partial<SessionEvent>) => {
        onEventRef.current({ ...payload, type: name } as SessionEvent);
      });
    }

    return () => {
      socket.emit("leave-session", { sessionCode });
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [sessionCode]);

  return { connected, presence };
}
