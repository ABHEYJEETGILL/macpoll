"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Alert } from "@/components/ui/Feedback";
import { apiFetch, errorMessage } from "@/lib/client/api";

type JoinResponse = {
  session: { id: string; sessionCode: string; courseName: string };
  isInstructor: boolean;
};

export default function StudentJoinPage() {
  const router = useRouter();
  const [sessionCode, setSessionCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleJoin(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const data = await apiFetch<JoinResponse>("/api/sessions/join", {
        method: "POST",
        body: JSON.stringify({ sessionCode })
      });

      router.push(
        data.isInstructor
          ? `/instructor/session/${data.session.id}`
          : `/student/session/${data.session.id}`
      );
    } catch (err) {
      setError(errorMessage(err));
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="mb-2 text-2xl font-semibold text-mcmaster-maroon">Join a live session</h1>
      <p className="mb-6 text-sm text-slate-600">
        Enter the session code shown on your instructor&apos;s screen. You will be enrolled in the
        course automatically.
      </p>

      <form onSubmit={handleJoin} className="space-y-4">
        <Input
          label="Session code"
          value={sessionCode}
          onChange={(event) => setSessionCode(event.target.value.toUpperCase())}
          required
          autoFocus
          autoCapitalize="characters"
          autoComplete="off"
          maxLength={12}
          placeholder="ABC123"
          className="text-center text-2xl font-mono tracking-[0.4em]"
        />
        {error && <Alert tone="error">{error}</Alert>}
        <Button
          type="submit"
          size="lg"
          className="w-full"
          loading={loading}
          disabled={sessionCode.trim().length < 4}
        >
          Join session
        </Button>
      </form>
    </div>
  );
}
