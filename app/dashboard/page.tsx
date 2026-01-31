"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

type User = {
  id: string;
  email: string;
  role: "INSTRUCTOR" | "STUDENT";
  verifiedAt: string | null;
};

type Course = {
  id: string;
  name: string;
  term: string;
  joinCode: string;
};

type LiveSession = {
  id: string;
  sessionCode: string;
  startedAt: string;
  endedAt: string | null;
};

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [courseName, setCourseName] = useState("");
  const [courseTerm, setCourseTerm] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    async function bootstrap() {
      const meRes = await fetch("/api/auth/me");
      const me = await meRes.json();
      if (!me.user) {
        window.location.href = "/auth/login";
        return;
      }
      setUser(me.user);
      const coursesRes = await fetch("/api/courses");
      const coursesJson = await coursesRes.json();
      setCourses(coursesJson.courses ?? []);
    }
    bootstrap();
  }, []);

  async function refreshSessions(courseId: string) {
    const res = await fetch(`/api/courses/${courseId}/sessions`);
    const data = await res.json();
    setSessions(data.sessions ?? []);
  }

  async function handleCreateCourse() {
    setStatus(null);
    const res = await fetch("/api/courses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: courseName, term: courseTerm })
    });
    const data = await res.json();
    if (!res.ok) {
      setStatus(data.error ?? "Failed to create course");
      return;
    }
    setCourses((prev) => [data.course, ...prev]);
    setCourseName("");
    setCourseTerm("");
  }

  async function handleJoinCourse() {
    setStatus(null);
    const res = await fetch("/api/courses/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ joinCode })
    });
    const data = await res.json();
    if (!res.ok) {
      setStatus(data.error ?? "Failed to join course");
      return;
    }
    setCourses((prev) => [data.course, ...prev]);
    setJoinCode("");
  }

  async function handleCreateSession(courseId: string) {
    setStatus(null);
    const res = await fetch(`/api/courses/${courseId}/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    });
    const data = await res.json();
    if (!res.ok) {
      setStatus(data.error ?? "Failed to create session");
      return;
    }
    setSelectedCourseId(courseId);
    await refreshSessions(courseId);
    setStatus(`Session started with code ${data.session.sessionCode}`);
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-10">
        <p className="text-sm text-slate-600">Loading...</p>
      </div>
    );
  }

  const isInstructor = user.role === "INSTRUCTOR";

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-mcmaster-maroon">Dashboard</h1>
          <p className="text-sm text-slate-600">
            Signed in as {user.email} ({isInstructor ? "Instructor" : "Student"})
          </p>
        </div>
        <Button
          variant="secondary"
          onClick={async () => {
            await fetch("/api/auth/logout", { method: "POST" });
            window.location.href = "/";
          }}
        >
          Log out
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <section className="md:col-span-2 rounded-lg border bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-slate-800">Courses</h2>
          {courses.length === 0 && (
            <p className="text-sm text-slate-600">No courses yet. Create or join one below.</p>
          )}
          <ul className="space-y-2">
            {courses.map((course) => (
              <li
                key={course.id}
                className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
              >
                <div>
                  <div className="font-medium text-slate-900">{course.name}</div>
                  <div className="text-xs text-slate-500">{course.term}</div>
                  {isInstructor && (
                    <div className="text-xs text-slate-500">
                      Join code: <span className="font-mono">{course.joinCode}</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {isInstructor ? (
                    <Button
                      variant="primary"
                      onClick={() => handleCreateSession(course.id)}
                      aria-label={`Start live session for ${course.name}`}
                    >
                      Start session
                    </Button>
                  ) : (
                    <Link
                      href={`/student/join?courseId=${course.id}`}
                      className="text-xs font-medium text-mcmaster-maroon underline"
                    >
                      Join live session
                    </Link>
                  )}
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setSelectedCourseId(course.id);
                      refreshSessions(course.id);
                    }}
                  >
                    Sessions
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-4 rounded-lg border bg-white p-4 shadow-sm">
          {isInstructor ? (
            <>
              <h2 className="text-sm font-semibold text-slate-800">Create course</h2>
              <Input
                label="Course name"
                value={courseName}
                onChange={(e) => setCourseName(e.target.value)}
              />
              <Input
                label="Term"
                value={courseTerm}
                onChange={(e) => setCourseTerm(e.target.value)}
                placeholder="e.g. Fall 2026"
              />
              <Button
                className="w-full"
                onClick={handleCreateCourse}
                disabled={!courseName || !courseTerm}
              >
                Create
              </Button>
            </>
          ) : (
            <>
              <h2 className="text-sm font-semibold text-slate-800">Join course</h2>
              <Input
                label="Join code"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              />
              <Button className="w-full" onClick={handleJoinCourse} disabled={!joinCode}>
                Join
              </Button>
            </>
          )}
        </section>
      </div>

      {selectedCourseId && sessions.length > 0 && (
        <section className="mt-8 rounded-lg border bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-slate-800">Live sessions</h2>
          <ul className="space-y-2 text-sm">
            {sessions.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between rounded-md border px-3 py-2"
              >
                <div>
                  <div className="font-mono text-xs text-slate-700">
                    Code: <span className="font-semibold">{s.sessionCode}</span>
                  </div>
                  <div className="text-xs text-slate-500">
                    Started {new Date(s.startedAt).toLocaleString()}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isInstructor ? (
                    <Link
                      href={`/instructor/session/${s.id}`}
                      className="text-xs font-medium text-mcmaster-maroon underline"
                    >
                      Open dashboard
                    </Link>
                  ) : (
                    <Link
                      href={`/student/session/${s.id}`}
                      className="text-xs font-medium text-mcmaster-maroon underline"
                    >
                      Join
                    </Link>
                  )}
                  {isInstructor && (
                    <a
                      href={`/api/attendance/export?liveSessionId=${s.id}`}
                      className="text-xs text-slate-600 underline"
                    >
                      Export CSV
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {status && <p className="mt-4 text-sm text-slate-700">{status}</p>}
    </div>
  );
}

