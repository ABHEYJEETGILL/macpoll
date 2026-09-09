"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Alert, Badge, EmptyState, LiveDot } from "@/components/ui/Feedback";
import { apiFetch, errorMessage } from "@/lib/client/api";
import { useSessionSocket, type SessionEvent } from "@/lib/client/useSessionSocket";

type PollType = "MULTIPLE_CHOICE" | "TRUE_FALSE" | "SHORT_ANSWER" | "NUMERIC";

type ActivePoll = {
  id: string;
  type: PollType;
  questionText: string;
  options: string[];
  isAnonymous: boolean;
  allowChange: boolean;
  timeLimitSec: number | null;
  openedAt: string;
};

type SessionView = {
  session: {
    id: string;
    sessionCode: string;
    endedAt: string | null;
    course: { name: string };
  };
  activePoll: ActivePoll | null;
  myAnswer: string | number | null;
  /** True once the student has taken part, including anonymous polls. */
  hasAnswered: boolean;
  answeredCount: number;
};

/** Seconds left on a timed poll, or null when the poll is untimed. */
function useCountdown(poll: ActivePoll | null): number | null {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (!poll?.timeLimitSec) {
      setRemaining(null);
      return;
    }

    const closesAt = new Date(poll.openedAt).getTime() + poll.timeLimitSec * 1000;
    const tick = () => setRemaining(Math.max(0, Math.ceil((closesAt - Date.now()) / 1000)));

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [poll?.id, poll?.openedAt, poll?.timeLimitSec]);

  return remaining;
}

export default function StudentSessionPage() {
  const params = useParams<{ sessionId: string }>();
  const [view, setView] = useState<SessionView | null>(null);
  const [answer, setAnswer] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Tracks which poll the current `answer` belongs to so a newly launched poll
  // clears the previous selection instead of carrying it over.
  const answeredPollRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<SessionView>(`/api/student/session/${params.sessionId}`);
      setView(data);
      setLoadError(null);

      const pollId = data.activePoll?.id ?? null;
      if (answeredPollRef.current !== pollId) {
        answeredPollRef.current = pollId;
        setAnswer(data.myAnswer !== null ? String(data.myAnswer) : "");
        setNotice(data.hasAnswered ? "Your answer is recorded." : null);
        setError(null);
      }
    } catch (err) {
      setLoadError(errorMessage(err));
    }
  }, [params.sessionId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleEvent = useCallback(
    (event: SessionEvent) => {
      if (event.type === "response-submitted") return;
      load();
      if (event.type === "poll-closed") setNotice("That poll is now closed.");
      if (event.type === "session-ended") setNotice("Your instructor ended the session.");
    },
    [load]
  );

  const { connected } = useSessionSocket({
    sessionCode: view?.session.sessionCode ?? null,
    onEvent: handleEvent
  });

  // Websockets can be blocked on campus networks, so poll as a slow fallback.
  useEffect(() => {
    if (connected) return;
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [connected, load]);

  const activePoll = view?.activePoll ?? null;
  const remaining = useCountdown(activePoll);
  const expired = remaining !== null && remaining <= 0;

  async function handleSubmit() {
    if (!activePoll) return;
    setSubmitting(true);
    setError(null);

    try {
      const payload =
        activePoll.type === "NUMERIC" ? { answer: Number(answer) } : { answer };

      await apiFetch(`/api/responses`, {
        method: "POST",
        body: JSON.stringify({ pollId: activePoll.id, ...payload })
      });

      setNotice("Answer submitted.");
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-md px-4 py-12">
        <Alert tone="error">{loadError}</Alert>
        <Link
          href="/student/join"
          className="mt-4 inline-block text-sm font-medium text-mcmaster-maroon underline"
        >
          Enter a different session code
        </Link>
      </div>
    );
  }

  if (!view) {
    return (
      <div className="mx-auto max-w-md px-4 py-12">
        <p className="text-sm text-slate-600">Loading session…</p>
      </div>
    );
  }

  const sessionEnded = view.session.endedAt !== null;
  const alreadyAnswered = view.hasAnswered;
  // Anonymous answers cannot be traced back to a student, so they can never be
  // edited regardless of the poll's allowChange setting.
  const canChange = Boolean(activePoll?.allowChange) && !activePoll?.isAnonymous;
  const canSubmit =
    !sessionEnded && !expired && answer.trim().length > 0 && (!alreadyAnswered || canChange);

  return (
    <div className="mx-auto max-w-md px-4 py-8">
      <header className="mb-6 text-center">
        <h1 className="text-xl font-semibold text-mcmaster-maroon">{view.session.course.name}</h1>
        <p className="mt-1 text-xs text-slate-600">
          Session <span className="font-mono font-semibold">{view.session.sessionCode}</span>
        </p>
        <div className="mt-2 flex items-center justify-center gap-3">
          <LiveDot live={connected} label={connected ? "Live" : "Reconnecting…"} />
          <span className="text-xs text-slate-500">{view.answeredCount} answered</span>
        </div>
      </header>

      {sessionEnded && (
        <div className="mb-4">
          <Alert tone="info">This session has ended. Thanks for attending.</Alert>
        </div>
      )}

      {!activePoll && !sessionEnded && (
        <EmptyState title="Waiting for the next poll">
          Keep this page open — the question appears here the moment your instructor launches it.
        </EmptyState>
      )}

      {activePoll && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm animate-fade-in">
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="text-xs uppercase tracking-wide text-slate-500">Active poll</span>
            <div className="flex items-center gap-2">
              {activePoll.isAnonymous && <Badge>Anonymous</Badge>}
              {remaining !== null && (
                <Badge tone={remaining <= 10 ? "error" : "info"}>
                  {expired ? "Time up" : `${remaining}s left`}
                </Badge>
              )}
            </div>
          </div>

          <p className="mb-4 text-base font-medium text-slate-900">{activePoll.questionText}</p>

          {(activePoll.type === "MULTIPLE_CHOICE" || activePoll.type === "TRUE_FALSE") && (
            <div
              role="radiogroup"
              aria-label="Answer options"
              className={`mb-4 grid gap-2 ${
                activePoll.options.length > 3 ? "grid-cols-2" : "grid-cols-1"
              }`}
            >
              {activePoll.options.map((option) => (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={answer === option}
                  disabled={sessionEnded || expired}
                  onClick={() => setAnswer(option)}
                  className={`min-h-[3rem] rounded-lg border px-4 py-3 text-left text-sm font-medium transition-colors disabled:opacity-60 ${
                    answer === option
                      ? "border-mcmaster-maroon bg-mcmaster-maroon text-white"
                      : "border-slate-300 bg-white text-slate-800 hover:bg-slate-50"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          )}

          {(activePoll.type === "SHORT_ANSWER" || activePoll.type === "NUMERIC") && (
            <input
              className="mb-4 w-full rounded-md border border-slate-300 px-3 py-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mcmaster-gold"
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              disabled={sessionEnded || expired}
              inputMode={activePoll.type === "NUMERIC" ? "decimal" : "text"}
              type={activePoll.type === "NUMERIC" ? "number" : "text"}
              maxLength={activePoll.type === "SHORT_ANSWER" ? 240 : undefined}
              aria-label="Your answer"
              placeholder={activePoll.type === "NUMERIC" ? "Enter a number" : "Type your answer"}
            />
          )}

          <Button
            size="lg"
            className="w-full"
            onClick={handleSubmit}
            loading={submitting}
            disabled={!canSubmit}
          >
            {alreadyAnswered ? "Update answer" : "Submit answer"}
          </Button>

          {alreadyAnswered && !canChange && (
            <p className="mt-2 text-center text-xs text-slate-500">
              {activePoll.isAnonymous
                ? "Anonymous answers cannot be changed."
                : "This poll does not allow changing your answer."}
            </p>
          )}

          <div className="mt-3 space-y-2">
            {error && <Alert tone="error">{error}</Alert>}
            {notice && !error && <Alert tone="success">{notice}</Alert>}
          </div>
        </div>
      )}
    </div>
  );
}
