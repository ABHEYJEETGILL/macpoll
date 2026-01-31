"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { io, Socket } from "socket.io-client";
import { Button } from "@/components/ui/Button";

type PollType = "MULTIPLE_CHOICE" | "TRUE_FALSE" | "SHORT_ANSWER" | "NUMERIC";

type Poll = {
  id: string;
  questionText: string;
  type: PollType;
  optionsJson: string[] | null;
  openedAt: string | null;
  closedAt: string | null;
};

type Session = {
  id: string;
  sessionCode: string;
  course: { name: string };
  polls: Poll[];
};

let socket: Socket | null = null;

export default function StudentSessionPage() {
  const params = useParams<{ sessionId: string }>();
  const [session, setSession] = useState<Session | null>(null);
  const [activePoll, setActivePoll] = useState<Poll | null>(null);
  const [answer, setAnswer] = useState<string>("");
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/student/session/${params.sessionId}`);
      const data = await res.json();
      setSession(data.session);
      setActivePoll(data.activePoll ?? null);
    }
    load();
  }, [params.sessionId]);

  useEffect(() => {
    if (!session) return;
    if (!socket) {
      socket = io(process.env.NEXT_PUBLIC_REALTIME_URL || "http://localhost:4000");
      socket.on("poll-opened", () => {
        window.location.reload();
      });
      socket.on("poll-closed", () => {
        setStatus("Poll closed");
      });
    }
    socket.emit("join-session", { sessionCode: session.sessionCode, role: "STUDENT" });
    return () => {
      socket?.emit("leave-session", { sessionCode: session.sessionCode });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.sessionCode]);

  async function handleSubmit() {
    if (!activePoll) return;
    setStatus(null);
    const res = await fetch("/api/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pollId: activePoll.id,
        answer: answer
      })
    });
    const data = await res.json();
    if (!res.ok) {
      setStatus(data.error ?? "Failed to submit");
      return;
    }
    setStatus("Response submitted");
    setAnswer("");
    if (socket && session) {
      socket.emit("response-submitted", {
        sessionCode: session.sessionCode,
        pollId: activePoll.id
      });
    }
  }

  if (!session) {
    return (
      <div className="mx-auto max-w-md px-4 py-10">
        <p className="text-sm text-slate-600">Loading session...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <header className="mb-6 text-center">
        <h1 className="text-xl font-semibold text-mcmaster-maroon">{session.course.name}</h1>
        <p className="text-xs text-slate-600">
          Session code: <span className="font-mono">{session.sessionCode}</span>
        </p>
      </header>

      {!activePoll && (
        <div className="rounded-lg border bg-white p-6 text-center text-sm text-slate-600">
          <p className="mb-2 font-medium text-slate-800">Waiting for poll</p>
          <p>Your instructor hasn&apos;t launched a poll yet. Hang tight.</p>
        </div>
      )}

      {activePoll && (
        <div className="rounded-lg border bg-white p-6 text-sm">
          <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">
            Active poll
          </p>
          <p className="mb-4 text-base font-medium text-slate-900">
            {activePoll.questionText}
          </p>

          {activePoll.type === "MULTIPLE_CHOICE" && (
            <div className="mb-4 grid grid-cols-2 gap-2">
              {(activePoll.optionsJson ?? []).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  className={`rounded-md px-3 py-2 text-sm ${
                    answer === opt
                      ? "bg-mcmaster-maroon text-white"
                      : "bg-slate-100 text-slate-800"
                  }`}
                  onClick={() => setAnswer(opt)}
                >
                  {opt}
                </button>
              ))}
            </div>
          )}

          {activePoll.type === "TRUE_FALSE" && (
            <div className="mb-4 grid grid-cols-2 gap-2">
              {["True", "False"].map((opt) => (
                <button
                  key={opt}
                  type="button"
                  className={`rounded-md px-3 py-2 text-sm ${
                    answer === opt
                      ? "bg-mcmaster-maroon text-white"
                      : "bg-slate-100 text-slate-800"
                  }`}
                  onClick={() => setAnswer(opt)}
                >
                  {opt}
                </button>
              ))}
            </div>
          )}

          {(activePoll.type === "SHORT_ANSWER" || activePoll.type === "NUMERIC") && (
            <input
              className="mb-4 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder={activePoll.type === "NUMERIC" ? "Enter a number" : "Your answer"}
            />
          )}

          <Button
            className="w-full"
            onClick={handleSubmit}
            disabled={!answer}
            aria-label="Submit response"
          >
            Submit response
          </Button>
          {status && <p className="mt-3 text-xs text-slate-700">{status}</p>}
        </div>
      )}
    </div>
  );
}

