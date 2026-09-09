"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ApiRequestError, apiFetch } from "@/lib/client/api";

type User = {
  id: string;
  name: string;
  email: string;
  role: "INSTRUCTOR" | "STUDENT" | "ADMIN";
  emailVerified: boolean;
};

type Course = {
  id: string;
  name: string;
  code: string;
  semester: string | null;
  joinCode?: string;
  _count?: { enrollments: number; polls: number };
};

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [form, setForm] = useState({ name: "", code: "", semester: "" });
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    async function bootstrap() {
      try {
        const me = await apiFetch<{ user: User | null }>("/api/auth/me");
        if (!me.user) {
          window.location.href = "/auth/login";
          return;
        }
        setUser(me.user);
        setCourses(await apiFetch<Course[]>("/api/courses"));
      } catch {
        window.location.href = "/auth/login";
      }
    }
    bootstrap();
  }, []);

  async function handleCreateCourse() {
    setStatus(null);
    setBusy(true);
    try {
      const course = await apiFetch<Course>("/api/courses", {
        method: "POST",
        body: JSON.stringify({
          name: form.name,
          code: form.code,
          semester: form.semester || undefined
        })
      });
      setCourses((prev) => [course, ...prev]);
      setForm({ name: "", code: "", semester: "" });
    } catch (err) {
      setStatus(err instanceof ApiRequestError ? err.message : "Could not create the course.");
    } finally {
      setBusy(false);
    }
  }

  async function handleJoinCourse() {
    setStatus(null);
    setBusy(true);
    try {
      const course = await apiFetch<Course>("/api/courses/join", {
        method: "POST",
        body: JSON.stringify({ joinCode })
      });
      setCourses((prev) =>
        prev.some((c) => c.id === course.id) ? prev : [course, ...prev]
      );
      setJoinCode("");
      setStatus(`Joined ${course.name}.`);
    } catch (err) {
      setStatus(err instanceof ApiRequestError ? err.message : "Could not join the course.");
    } finally {
      setBusy(false);
    }
  }

  if (!user) {
    return (
      <div className="max-w-md px-4 py-10 mx-auto">
        <p className="text-sm text-slate-600">Loading...</p>
      </div>
    );
  }

  const isInstructor = user.role === "INSTRUCTOR" || user.role === "ADMIN";

  return (
    <div className="max-w-5xl px-4 py-8 mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-mcmaster-maroon">Dashboard</h1>
          <p className="text-sm text-slate-600">
            Signed in as {user.email} ({isInstructor ? "Instructor" : "Student"})
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isInstructor && (
            <Link href="/instructor/polls" className="btn-primary">
              Manage polls
            </Link>
          )}
          <Button
            variant="secondary"
            onClick={async () => {
              await apiFetch("/api/auth/logout", { method: "POST" }).catch(() => {});
              window.location.href = "/";
            }}
          >
            Log out
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <section className="p-4 bg-white border rounded-lg shadow-sm md:col-span-2">
          <h2 className="mb-3 text-sm font-semibold text-slate-800">Courses</h2>
          {courses.length === 0 ? (
            <p className="text-sm text-slate-600">
              {isInstructor
                ? "No courses yet. Create one to get started."
                : "No courses yet. Enter a join code to enrol."}
            </p>
          ) : (
            <ul className="space-y-2">
              {courses.map((course) => (
                <li
                  key={course.id}
                  className="flex items-center justify-between px-3 py-2 text-sm border rounded-md"
                >
                  <div>
                    <div className="font-medium text-slate-900">
                      {course.code} - {course.name}
                    </div>
                    {course.semester && (
                      <div className="text-xs text-slate-500">{course.semester}</div>
                    )}
                    {isInstructor && course.joinCode && (
                      <div className="text-xs text-slate-500">
                        Join code: <span className="font-mono">{course.joinCode}</span>
                      </div>
                    )}
                  </div>
                  {isInstructor ? (
                    <Link
                      href="/instructor/polls"
                      className="text-xs font-medium underline text-mcmaster-maroon"
                    >
                      Open
                    </Link>
                  ) : (
                    <Link
                      href={`/student/courses/${course.id}`}
                      className="text-xs font-medium underline text-mcmaster-maroon"
                    >
                      Open
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="p-4 space-y-4 bg-white border rounded-lg shadow-sm">
          {isInstructor ? (
            <>
              <h2 className="text-sm font-semibold text-slate-800">Create course</h2>
              <Input
                label="Course code"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="e.g. COMPSCI 1JC3"
              />
              <Input
                label="Course name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
              <Input
                label="Semester"
                value={form.semester}
                onChange={(e) => setForm({ ...form, semester: e.target.value })}
                placeholder="e.g. Fall 2026"
              />
              <Button
                className="w-full"
                onClick={handleCreateCourse}
                disabled={busy || !form.name || !form.code}
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
              <Button className="w-full" onClick={handleJoinCourse} disabled={busy || !joinCode}>
                Join
              </Button>
            </>
          )}
        </section>
      </div>

      {status && <p className="mt-4 text-sm text-slate-700">{status}</p>}
    </div>
  );
}
