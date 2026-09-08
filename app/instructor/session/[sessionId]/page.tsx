"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Alert, Badge, EmptyState, LiveDot } from "@/components/ui/Feedback";
import { PollResults, type PollResult } from "@/components/PollResults";
import { apiFetch, errorMessage } from "@/lib/client/api";
import { useSessionSocket, type SessionEvent } from "@/lib/client/useSessionSocket";

type PollType = "MULTIPLE_CHOICE" | "TRUE_FALSE" | "SHORT_ANSWER" | "NUMERIC";

type SessionInfo = {
  id: string;
  sessionCode: string;
  startedAt: string;
  endedAt: string | null;
  course: { id: string; name: string; term: string };
};

type ResultsPayload = {
  current: PollResult | null;
  results: PollResult[];
  attendance: { joined: number; present: number };
};

type RosterRow = {
  userId: string;
  email: string;
  present: boolean;
  joined: boolean;
  answered: number;
};

type RosterPayload = {
  roster: RosterRow[];
  summary: { enrolled: number; joined: number; present: number };
};

const POLL_TYPES: { value: PollType; label: string }[] = [
  { value: "MULTIPLE_CHOICE", label: "Multiple choice" },
  { value: "TRUE_FALSE", label: "True / False" },
  { value: "SHORT_ANSWER", label: "Short answer" },
  { value: "NUMERIC", label: "Numeric" }
];

export default function InstructorSessionPage() {
  const params = useParams<{ sessionId: string }>();

  const [session, setSession] = useState<SessionInfo | null>(null);
  const [enrolledCount, setEnrolledCount] = useState(0);
  const [results, setResults] = useState<ResultsPayload | null>(null);
  const [roster, setRoster] = useState<RosterPayload | null>(null);
  const [showRoster, setShowRoster] = useState(false);

  const [questionText, setQuestionText] = useState("");
  const [pollType, setPollType] = useState<PollType>("MULTIPLE_CHOICE");
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [allowChange, setAllowChange] = useState(true);
  const [timeLimit, setTimeLimit] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadSession = useCallback(async () => {
    try {
      const data = await apiFetch<{ session: SessionInfo; enrolledCount: number }>(
        `/api/instructor/session/${params.sessionId}`
      );
      setSession(data.session);
      setEnrolledCount(data.enrolledCount);
      setLoadError(null);
    } catch (err) {
      setLoadError(errorMessage(err));
    }
  }, [params.sessionId]);

  const loadResults = useCallback(async () => {
    try {
      const data = await apiFetch<ResultsPayload>(
        `/api/instructor/session/${params.sessionId}/results`
      );
      setResults(data);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [params.sessionId]);

  const loadRoster = useCallback(async () => {
    try {
      const data = await apiFetch<RosterPayload>(
        `/api/instructor/session/${params.sessionId}/attendance`
      );
      setRoster(data);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [params.sessionId]);

  useEffect(() => {
    loadSession();
    loadResults();
  }, [loadSession, loadResults]);

  const handleEvent = useCallback(
    (event: SessionEvent) => {
      loadResults();
      if (event.type !== "response-submitted") loadSession();
      if (showRoster) loadRoster();
    },
    [loadResults, loadSession, loadRoster, showRoster]
  );

  const { connected, presence } = useSessionSocket({
    sessionCode: session?.sessionCode ?? null,
    onEvent: handleEvent
  });

  // Fallback refresh when the websocket is unavailable.
  useEffect(() => {
    if (connected || session?.endedAt) return;
    const interval = setInterval(loadResults, 5000);
    return () => clearInterval(interval);
  }, [connected, session?.endedAt, loadResults]);

  async function handleLaunchPoll() {
    setBusy("launch");
    setError(null);
    setNotice(null);

    try {
      const trimmedOptions = options.map((option) => option.trim()).filter(Boolean);
      const parsedLimit = timeLimit.trim() === "" ? null : Number(timeLimit);

      await apiFetch("/api/polls", {
        method: "POST",
        body: JSON.stringify({
          liveSessionId: params.sessionId,
          type: pollType,
          questionText: questionText.trim(),
          options: pollType === "MULTIPLE_CHOICE" ? trimmedOptions : undefined,
          isAnonymous,
          allowChange,
          timeLimitSec: parsedLimit
        })
      });

      setQuestionText("");
      setNotice("Poll launched. Students see it now.");
      await Promise.all([loadSession(), loadResults()]);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function handleClosePoll(pollId: string, close: boolean) {
    setBusy(`poll-${pollId}`);
    setError(null);
    try {
      await apiFetch("/api/polls", {
        method: "PATCH",
        body: JSON.stringify({ pollId, close })
      });
      setNotice(close ? "Poll closed." : "Poll reopened.");
      await Promise.all([loadSession(), loadResults()]);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function handleEndSession() {
    if (!window.confirm("End this session? Students will no longer be able to answer.")) return;

    setBusy("end");
    setError(null);
    try {
      await apiFetch(`/api/instructor/session/${params.sessionId}/end`, { method: "POST" });
      setNotice("Session ended.");
      await Promise.all([loadSession(), loadResults()]);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <Alert tone="error">{loadError}</Alert>
        <Link
          href="/dashboard"
          className="mt-4 inline-block text-sm font-medium text-mcmaster-maroon underline"
        >
          Back to dashboard
        </Link>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12">
        <p className="text-sm text-slate-600">Loading session…</p>
      </div>
    );
  }

  const ended = session.endedAt !== null;
  const current = results?.current ?? null;
  const history = (results?.results ?? []).filter((result) => !result.isOpen);
  const validOptions = options.map((option) => option.trim()).filter(Boolean);
  const canLaunch =
    !ended &&
    questionText.trim().length >= 3 &&
    (pollType !== "MULTIPLE_CHOICE" ||
      (validOptions.length >= 2 && new Set(validOptions).size === validOptions.length));

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-mcmaster-maroon">
            {session.course.name} · Live session
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Students join at <span className="font-medium">/student/join</span> with code{" "}
            <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-base font-bold tracking-[0.3em]">
              {session.sessionCode}
            </span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <LiveDot live={connected && !ended} label={ended ? "Ended" : connected ? "Live" : "Offline"} />
          <div className="rounded-md bg-slate-100 px-3 py-2 text-xs text-slate-700">
            <span className="font-semibold">{presence}</span> connected ·{" "}
            <span className="font-semibold">{results?.attendance.present ?? 0}</span> present of{" "}
            {enrolledCount}
          </div>
          <a
            href={`/api/attendance/export?liveSessionId=${session.id}`}
            className="rounded text-xs font-medium text-slate-600 underline"
          >
            Export CSV
          </a>
          {!ended && (
            <Button variant="danger" size="sm" loading={busy === "end"} onClick={handleEndSession}>
              End session
            </Button>
          )}
        </div>
      </header>

      <div className="mb-4 space-y-3">
        {ended && <Alert tone="info">This session has ended. Results remain available below.</Alert>}
        {error && <Alert tone="error">{error}</Alert>}
        {notice && !error && <Alert tone="success">{notice}</Alert>}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Launch a poll"
            description="Launching closes whatever poll is currently open."
          />
          <CardBody className="space-y-4">
            <Input
              label="Question"
              value={questionText}
              onChange={(event) => setQuestionText(event.target.value)}
              disabled={ended}
              maxLength={500}
              placeholder="What is the time complexity of binary search?"
            />

            <div>
              <span className="mb-1.5 block text-sm font-medium text-slate-800">Type</span>
              <div className="flex flex-wrap gap-2">
                {POLL_TYPES.map((type) => (
                  <button
                    key={type.value}
                    type="button"
                    disabled={ended}
                    aria-pressed={pollType === type.value}
                    onClick={() => setPollType(type.value)}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-60 ${
                      pollType === type.value
                        ? "bg-mcmaster-maroon text-white"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            </div>

            {pollType === "MULTIPLE_CHOICE" && (
              <div className="space-y-2">
                <span className="block text-sm font-medium text-slate-800">Options</span>
                {options.map((option, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      value={option}
                      disabled={ended}
                      aria-label={`Option ${index + 1}`}
                      placeholder={`Option ${index + 1}`}
                      className="flex-1"
                      onChange={(event) =>
                        setOptions((prev) =>
                          prev.map((existing, i) => (i === index ? event.target.value : existing))
                        )
                      }
                    />
                    {options.length > 2 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={ended}
                        aria-label={`Remove option ${index + 1}`}
                        onClick={() => setOptions((prev) => prev.filter((_, i) => i !== index))}
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                ))}
                {options.length < 8 && (
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={ended}
                    onClick={() => setOptions((prev) => [...prev, ""])}
                  >
                    Add option
                  </Button>
                )}
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                label="Time limit (seconds)"
                type="number"
                min={5}
                max={3600}
                value={timeLimit}
                disabled={ended}
                onChange={(event) => setTimeLimit(event.target.value)}
                placeholder="Optional"
              />
              <div className="flex flex-col justify-end gap-2 pb-1 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={isAnonymous}
                    disabled={ended}
                    onChange={(event) => setIsAnonymous(event.target.checked)}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  Anonymous responses
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={allowChange}
                    disabled={ended || isAnonymous}
                    onChange={(event) => setAllowChange(event.target.checked)}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  Allow changing answers
                </label>
              </div>
            </div>

            {isAnonymous && (
              <p className="text-xs text-slate-500">
                Anonymous polls record attendance but not who chose what, so answers cannot be
                changed and are excluded from per-student CSV columns.
              </p>
            )}

            <Button
              className="w-full"
              size="lg"
              loading={busy === "launch"}
              disabled={!canLaunch}
              onClick={handleLaunchPoll}
            >
              Launch poll
            </Button>
          </CardBody>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Live results"
              action={
                current && (
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={busy === `poll-${current.pollId}`}
                    onClick={() => handleClosePoll(current.pollId, true)}
                  >
                    Close poll
                  </Button>
                )
              }
            />
            <CardBody>
              {current ? (
                <>
                  <p className="mb-1 text-sm font-medium text-slate-900">{current.questionText}</p>
                  <p className="mb-3 text-xs uppercase tracking-wide text-slate-500">
                    {current.type.replace(/_/g, " ")}
                  </p>
                  <PollResults result={current} />
                </>
              ) : (
                <EmptyState title="No poll is open">
                  Launch a poll and results appear here as students answer.
                </EmptyState>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Attendance"
              description={
                roster
                  ? `${roster.summary.present} present · ${roster.summary.joined} joined · ${roster.summary.enrolled} enrolled`
                  : undefined
              }
              action={
                <Button
                  size="sm"
                  variant="ghost"
                  aria-expanded={showRoster}
                  onClick={() => {
                    const next = !showRoster;
                    setShowRoster(next);
                    if (next) loadRoster();
                  }}
                >
                  {showRoster ? "Hide" : "Show roster"}
                </Button>
              }
            />
            {showRoster && (
              <CardBody>
                {!roster ? (
                  <p className="text-sm text-slate-600">Loading roster…</p>
                ) : roster.roster.length === 0 ? (
                  <EmptyState title="Nobody is enrolled yet">
                    Students appear here once they join with the session or course code.
                  </EmptyState>
                ) : (
                  <div className="max-h-80 overflow-y-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="sticky top-0 bg-white text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                          <th scope="col" className="py-2">
                            Student
                          </th>
                          <th scope="col" className="py-2">
                            Status
                          </th>
                          <th scope="col" className="py-2 text-right">
                            Answers
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {roster.roster.map((row) => (
                          <tr key={row.userId}>
                            <td className="py-2 pr-2">
                              <span className="block truncate" title={row.email}>
                                {row.email}
                              </span>
                            </td>
                            <td className="py-2">
                              {row.present ? (
                                <Badge tone="success">Present</Badge>
                              ) : row.joined ? (
                                <Badge tone="warning">Joined</Badge>
                              ) : (
                                <Badge>Absent</Badge>
                              )}
                            </td>
                            <td className="py-2 text-right tabular-nums">{row.answered}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardBody>
            )}
          </Card>
        </div>
      </div>

      {history.length > 0 && (
        <Card className="mt-6">
          <CardHeader title="Previous polls" description={`${history.length} closed this session`} />
          <CardBody>
            <ul className="grid gap-6 md:grid-cols-2">
              {history.map((result) => (
                <li key={result.pollId} className="rounded-lg border border-slate-200 p-4">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{result.questionText}</p>
                      <p className="text-xs uppercase tracking-wide text-slate-500">
                        {result.type.replace(/_/g, " ")}
                      </p>
                    </div>
                    {!ended && (
                      <Button
                        size="sm"
                        variant="ghost"
                        loading={busy === `poll-${result.pollId}`}
                        onClick={() => handleClosePoll(result.pollId, false)}
                      >
                        Reopen
                      </Button>
                    )}
                  </div>
                  <PollResults result={result} />
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
