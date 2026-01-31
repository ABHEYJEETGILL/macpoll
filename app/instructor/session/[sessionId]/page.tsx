"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { io, Socket } from "socket.io-client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

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

type AggregateResult = {
  pollId: string;
  counts: Record<string, number>;
};

let socket: Socket | null = null;

export default function InstructorSessionPage() {
  const params = useParams<{ sessionId: string }>();
  const [session, setSession] = useState<Session | null>(null);
  const [questionText, setQuestionText] = useState("");
  const [pollType, setPollType] = useState<PollType>("MULTIPLE_CHOICE");
  const [options, setOptions] = useState<string[]>(["A", "B", "C"]);
  const [status, setStatus] = useState<string | null>(null);
  const [presence, setPresence] = useState(0);
  const [results, setResults] = useState<AggregateResult | null>(null);

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/instructor/session/${params.sessionId}`);
      const data = await res.json();
      setSession(data.session);
    }
    load();
  }, [params.sessionId]);

  useEffect(() => {
    if (!session) return;
    if (!socket) {
      socket = io(process.env.NEXT_PUBLIC_REALTIME_URL || "http://localhost:4000");
      socket.on("presence-update", (payload: { count: number }) => {
        setPresence(payload.count);
      });
      socket.on("response-submitted", () => {
        refreshResults();
      });
    }
    socket.emit("join-session", { sessionCode: session.sessionCode, role: "INSTRUCTOR" });
    return () => {
      socket?.emit("leave-session", { sessionCode: session.sessionCode });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.sessionCode]);

  async function refreshResults() {
    if (!session) return;
    const res = await fetch(`/api/instructor/session/${session.id}/results`);
    const data = await res.json();
    setResults(data.current ?? null);
  }

  async function handleCreatePoll() {
    if (!session) return;
    const res = await fetch("/api/polls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        liveSessionId: session.id,
        type: pollType,
        questionText,
        options: pollType === "MULTIPLE_CHOICE" ? options : undefined,
        isAnonymous: false,
        allowChange: true
      })
    });
    const data = await res.json();
    if (!res.ok) {
      setStatus(data.error ?? "Failed to create poll");
      return;
    }
    setSession((prev) =>
      prev ? { ...prev, polls: [data.poll, ...prev.polls] } : prev
    );
    setQuestionText("");
    setStatus("Poll created & opened");
    if (socket) {
      socket.emit("poll-opened", {
        sessionCode: session.sessionCode,
        pollId: data.poll.id
      });
    }
  }

  const activePoll = session?.polls.find((p) => p.openedAt && !p.closedAt) ?? null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {session ? (
        <>
          <header className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold text-mcmaster-maroon">
                {session.course.name} • Live session
              </h1>
              <p className="text-xs text-slate-600">
                Session code: <span className="font-mono">{session.sessionCode}</span>
              </p>
            </div>
            <div className="rounded-md bg-slate-100 px-3 py-2 text-xs text-slate-700">
              Connected students: <span className="font-semibold">{presence}</span>
            </div>
          </header>

          <div className="grid gap-6 md:grid-cols-2">
            <section className="rounded-lg border bg-white p-4 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold text-slate-800">Create poll</h2>
              <div className="space-y-3 text-sm">
                <Input
                  label="Question"
                  value={questionText}
                  onChange={(e) => setQuestionText(e.target.value)}
                />
                <div>
                  <div className="mb-1 text-sm font-medium text-slate-800">Type</div>
                  <div className="flex flex-wrap gap-2">
                    {(["MULTIPLE_CHOICE", "TRUE_FALSE", "SHORT_ANSWER", "NUMERIC"] as PollType[]).map(
                      (t) => (
                        <button
                          key={t}
                          type="button"
                          className={`rounded-full px-3 py-1 text-xs ${
                            pollType === t
                              ? "bg-mcmaster-maroon text-white"
                              : "bg-slate-100 text-slate-700"
                          }`}
                          onClick={() => setPollType(t)}
                        >
                          {t.replace("_", " ")}
                        </button>
                      )
                    )}
                  </div>
                </div>
                {pollType === "MULTIPLE_CHOICE" && (
                  <div className="space-y-2">
                    <div className="text-sm font-medium text-slate-800">Options</div>
                    {options.map((opt, idx) => (
                      <Input
                        key={idx}
                        value={opt}
                        onChange={(e) =>
                          setOptions((prev) =>
                            prev.map((o, i) => (i === idx ? e.target.value : o))
                          )
                        }
                      />
                    ))}
                  </div>
                )}
                <Button
                  className="w-full"
                  onClick={handleCreatePoll}
                  disabled={!questionText.trim()}
                >
                  Launch poll
                </Button>
              </div>
            </section>

            <section className="rounded-lg border bg-white p-4 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold text-slate-800">Live results</h2>
              {!activePoll && (
                <p className="text-sm text-slate-600">No active poll. Create one to begin.</p>
              )}
              {activePoll && (
                <div>
                  <p className="mb-1 text-sm font-medium text-slate-900">
                    {activePoll.questionText}
                  </p>
                  <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">
                    {activePoll.type.replace("_", " ")}
                  </p>
                  <div className="mt-2 space-y-1">
                    {results &&
                      Object.entries(results.counts).map(([key, value]) => (
                        <div key={key} className="flex items-center gap-2">
                          <span className="w-10 text-xs font-mono">{key}</span>
                          <div className="h-3 flex-1 rounded-full bg-slate-100">
                            <div
                              className="h-3 rounded-full bg-mcmaster-maroon"
                              style={{
                                width: `${Math.min(100, value * 20)}%`
                              }}
                            />
                          </div>
                          <span className="w-8 text-right text-xs text-slate-700">{value}</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </section>
          </div>
          {status && <p className="mt-4 text-sm text-slate-700">{status}</p>}
        </>
      ) : (
        <p className="text-sm text-slate-600">Loading session...</p>
      )}
    </div>
  );
}

