"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Alert, Badge, EmptyState } from "@/components/ui/Feedback";
import { apiFetch, errorMessage } from "@/lib/client/api";

type Role = "INSTRUCTOR" | "STUDENT";

type User = { id: string; email: string; role: Role; verifiedAt: string | null };

type Course = {
  id: string;
  name: string;
  term: string;
  joinCode?: string;
  instructorEmail?: string;
  _count?: { enrollments: number; liveSessions: number };
};

type LiveSession = {
  id: string;
  sessionCode: string;
  startedAt: string;
  endedAt: string | null;
  _count?: { polls: number; attendances: number };
};

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [expandedCourseId, setExpandedCourseId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<LiveSession[]>([]);

  const [courseName, setCourseName] = useState("");
  const [courseTerm, setCourseTerm] = useState("");
  const [joinCode, setJoinCode] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function bootstrap() {
      try {
        const me = await apiFetch<{ user: User | null }>("/api/auth/me");
        if (!me.user) {
          window.location.href = "/auth/login?next=/dashboard";
          return;
        }
        setUser(me.user);

        const data = await apiFetch<{ courses: Course[] }>("/api/courses");
        setCourses(data.courses);
      } catch (err) {
        setError(errorMessage(err));
      } finally {
        setLoading(false);
      }
    }
    bootstrap();
  }, []);

  const loadSessions = useCallback(async (courseId: string) => {
    setExpandedCourseId(courseId);
    try {
      const data = await apiFetch<{ sessions: LiveSession[] }>(
        `/api/courses/${courseId}/sessions`
      );
      setSessions(data.sessions);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, []);

  async function handleCreateCourse() {
    setBusy("create-course");
    setError(null);
    setNotice(null);
    try {
      const data = await apiFetch<{ course: Course }>("/api/courses", {
        method: "POST",
        body: JSON.stringify({ name: courseName, term: courseTerm })
      });
      setCourses((prev) => [data.course, ...prev]);
      setCourseName("");
      setCourseTerm("");
      setNotice(`Created ${data.course.name}. Share join code ${data.course.joinCode}.`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function handleJoinCourse() {
    setBusy("join-course");
    setError(null);
    setNotice(null);
    try {
      const data = await apiFetch<{ course: Course; alreadyEnrolled: boolean }>(
        "/api/courses/join",
        { method: "POST", body: JSON.stringify({ joinCode }) }
      );

      setCourses((prev) =>
        prev.some((course) => course.id === data.course.id) ? prev : [data.course, ...prev]
      );
      setJoinCode("");
      setNotice(
        data.alreadyEnrolled
          ? `You were already enrolled in ${data.course.name}.`
          : `Joined ${data.course.name}.`
      );
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function handleStartSession(courseId: string) {
    setBusy(`start-${courseId}`);
    setError(null);
    setNotice(null);
    try {
      const data = await apiFetch<{ session: LiveSession }>(
        `/api/courses/${courseId}/sessions`,
        { method: "POST", body: JSON.stringify({}) }
      );
      setNotice(`Session live. Students join with code ${data.session.sessionCode}.`);
      await loadSessions(courseId);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12">
        <p className="text-sm text-slate-600">Loading your dashboard…</p>
      </div>
    );
  }

  if (!user) return null;

  const isInstructor = user.role === "INSTRUCTOR";

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-mcmaster-maroon">Dashboard</h1>
          <p className="text-sm text-slate-600">
            {user.email} · {isInstructor ? "Instructor" : "Student"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {!user.verifiedAt && <Badge tone="warning">Email not verified</Badge>}
          <Button
            variant="secondary"
            onClick={async () => {
              await apiFetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
              window.location.href = "/";
            }}
          >
            Log out
          </Button>
        </div>
      </div>

      <div className="mb-4 space-y-3">
        {error && <Alert tone="error">{error}</Alert>}
        {notice && <Alert tone="success">{notice}</Alert>}
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader
            title="Your courses"
            description={isInstructor ? "Courses you teach" : "Courses you are enrolled in"}
          />
          <CardBody>
            {courses.length === 0 ? (
              <EmptyState title="No courses yet">
                {isInstructor
                  ? "Create your first course to start running polls."
                  : "Join a course with the code from your instructor."}
              </EmptyState>
            ) : (
              <ul className="space-y-2">
                {courses.map((course) => (
                  <li key={course.id} className="rounded-md border border-slate-200">
                    <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5">
                      <div className="min-w-0">
                        <div className="font-medium text-slate-900">{course.name}</div>
                        <div className="text-xs text-slate-500">
                          {course.term}
                          {course.instructorEmail && ` · ${course.instructorEmail}`}
                          {course._count && ` · ${course._count.enrollments} enrolled`}
                        </div>
                        {course.joinCode && (
                          <div className="mt-1 text-xs text-slate-600">
                            Join code:{" "}
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono font-semibold tracking-wider">
                              {course.joinCode}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        {isInstructor ? (
                          <Button
                            size="sm"
                            loading={busy === `start-${course.id}`}
                            onClick={() => handleStartSession(course.id)}
                          >
                            Start session
                          </Button>
                        ) : (
                          <Link
                            href="/student/join"
                            className="rounded text-xs font-medium text-mcmaster-maroon underline"
                          >
                            Join live session
                          </Link>
                        )}
                        {isInstructor && (
                          <Button
                            size="sm"
                            variant="ghost"
                            aria-expanded={expandedCourseId === course.id}
                            onClick={() =>
                              expandedCourseId === course.id
                                ? setExpandedCourseId(null)
                                : loadSessions(course.id)
                            }
                          >
                            Sessions
                          </Button>
                        )}
                      </div>
                    </div>

                    {isInstructor && expandedCourseId === course.id && (
                      <div className="border-t border-slate-100 bg-slate-50/60 px-3 py-2">
                        {sessions.length === 0 ? (
                          <p className="py-2 text-xs text-slate-500">No sessions yet.</p>
                        ) : (
                          <ul className="divide-y divide-slate-200">
                            {sessions.map((session) => (
                              <li
                                key={session.id}
                                className="flex flex-wrap items-center justify-between gap-2 py-2"
                              >
                                <div className="text-xs">
                                  <span className="rounded bg-white px-1.5 py-0.5 font-mono font-semibold tracking-wider">
                                    {session.sessionCode}
                                  </span>
                                  <span className="ml-2 text-slate-500">
                                    {new Date(session.startedAt).toLocaleString()}
                                  </span>
                                  {session._count && (
                                    <span className="ml-2 text-slate-500">
                                      {session._count.polls} polls ·{" "}
                                      {session._count.attendances} joined
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-3 text-xs">
                                  {session.endedAt ? (
                                    <Badge>Ended</Badge>
                                  ) : (
                                    <Badge tone="success">Live</Badge>
                                  )}
                                  <Link
                                    href={`/instructor/session/${session.id}`}
                                    className="rounded font-medium text-mcmaster-maroon underline"
                                  >
                                    Open
                                  </Link>
                                  <a
                                    href={`/api/attendance/export?liveSessionId=${session.id}`}
                                    className="rounded text-slate-600 underline"
                                  >
                                    Export CSV
                                  </a>
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={isInstructor ? "Create a course" : "Join a course"} />
          <CardBody className="space-y-3">
            {isInstructor ? (
              <>
                <Input
                  label="Course name"
                  value={courseName}
                  onChange={(event) => setCourseName(event.target.value)}
                  placeholder="COMP SCI 1JC3"
                />
                <Input
                  label="Term"
                  value={courseTerm}
                  onChange={(event) => setCourseTerm(event.target.value)}
                  placeholder="Fall 2026"
                />
                <Button
                  className="w-full"
                  loading={busy === "create-course"}
                  disabled={courseName.trim().length < 2 || courseTerm.trim().length < 2}
                  onClick={handleCreateCourse}
                >
                  Create course
                </Button>
              </>
            ) : (
              <>
                <Input
                  label="Join code"
                  value={joinCode}
                  onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
                  placeholder="ABC123"
                  className="font-mono tracking-widest"
                  hint="Ask your instructor for the course join code."
                />
                <Button
                  className="w-full"
                  loading={busy === "join-course"}
                  disabled={joinCode.trim().length < 4}
                  onClick={handleJoinCourse}
                >
                  Join course
                </Button>
                <p className="text-xs text-slate-500">
                  Joining a live session with its session code enrolls you automatically.
                </p>
              </>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
