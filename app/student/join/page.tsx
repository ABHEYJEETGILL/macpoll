"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export default function StudentJoinPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [sessionCode, setSessionCode] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  async function handleJoin(e: FormEvent) {
    e.preventDefault();
    setStatus(null);
    const res = await fetch("/api/sessions/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionCode })
    });
    const data = await res.json();
    if (!res.ok) {
      setStatus(data.error ?? "Failed to join session");
      return;
    }
    setStatus("Joined session. Redirecting...");
    router.push(`/student/session/${data.session.id}`);
  }

  const courseId = searchParams.get("courseId");

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <h1 className="mb-4 text-2xl font-semibold text-mcmaster-maroon">Join live session</h1>
      <p className="mb-4 text-sm text-slate-600">
        Enter the session code shown on your instructor&apos;s screen.
      </p>
      {courseId && (
        <p className="mb-2 text-xs text-slate-500">
          Joining from course context: <span className="font-mono">{courseId}</span>
        </p>
      )}
      <form onSubmit={handleJoin} className="space-y-4">
        <Input
          label="Session code"
          value={sessionCode}
          onChange={(e) => setSessionCode(e.target.value.toUpperCase())}
          required
        />
        <Button type="submit" className="w-full">
          Join
        </Button>
      </form>
      {status && <p className="mt-4 text-sm text-slate-700">{status}</p>}
    </div>
  );
}

