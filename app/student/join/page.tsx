"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ApiRequestError, apiFetch } from "@/lib/client/api";

export default function JoinCoursePage() {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const course = await apiFetch<{ id: string }>("/api/courses/join", {
        method: "POST",
        body: JSON.stringify({ joinCode })
      });
      router.push(`/student/courses/${course.id}`);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Could not join that course.");
      setBusy(false);
    }
  }

  return (
    <div className="max-w-md px-4 py-12 mx-auto">
      <h1 className="text-2xl font-semibold text-mcmaster-maroon">Join a course</h1>
      <p className="mt-1 text-sm text-slate-600">
        Enter the join code your instructor shared.
      </p>

      <form onSubmit={handleJoin} className="mt-6 space-y-4">
        <Input
          label="Join code"
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
          placeholder="ABC123"
          autoFocus
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" className="w-full" disabled={busy || !joinCode}>
          {busy ? "Joining..." : "Join course"}
        </Button>
      </form>
    </div>
  );
}
