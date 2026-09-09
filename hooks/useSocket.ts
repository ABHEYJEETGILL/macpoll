"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";

type Listener = (...args: any[]) => void;

const REALTIME_URL = process.env.NEXT_PUBLIC_REALTIME_URL ?? "http://localhost:4000";

/**
 * Subscribes to realtime events for one course room.
 *
 * Only `on` is exposed: poll and attendance events originate on the server, so
 * there is nothing for a client to emit. The handshake carries the session
 * cookie, and the server rejects unauthenticated or unenrolled sockets.
 */
export function useSocket(courseId: string | null, _role?: string) {
  const socketRef = useRef<Socket | null>(null);
  const listenersRef = useRef<Map<string, Set<Listener>>>(new Map());
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!courseId) return;

    const socket = io(REALTIME_URL, {
      withCredentials: true,
      transports: ["websocket", "polling"]
    });
    socketRef.current = socket;

    for (const [event, callbacks] of listenersRef.current) {
      for (const cb of callbacks) socket.on(event, cb);
    }

    socket.on("connect", () => {
      setConnected(true);
      socket.emit("join-course", { courseId });
    });
    socket.on("disconnect", () => setConnected(false));

    return () => {
      socket.emit("leave-course", { courseId });
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [courseId]);

  const on = useCallback((event: string, callback: Listener) => {
    let callbacks = listenersRef.current.get(event);
    if (!callbacks) {
      callbacks = new Set();
      listenersRef.current.set(event, callbacks);
    }
    callbacks.add(callback);
    socketRef.current?.on(event, callback);

    return () => {
      callbacks!.delete(callback);
      socketRef.current?.off(event, callback);
    };
  }, []);

  return { on, connected };
}
