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
  const [loading, setLoading] = useState(false);
 
  async function handleJoin(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch("/api/sessions/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionCode: sessionCode.toUpperCase() })
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus(data.error ?? "Could not join session");
      } else {
        router.push(`/student/session/${data.session.id}`);
      }
    } catch {
      setStatus("Unexpected error");
    } finally {
      setLoading(false);
    }
  }
 
  return (
    <div className="max-w-md px-4 py-10 mx-auto">
      <h1 className="mb-2 text-2xl font-semibold text-mcmaster-maroon">Join a live session</h1>
      <p className="mb-6 text-sm text-slate-600">
        Enter the 6-character session code your instructor displayed.
      </p>
      <form onSubmit={handleJoin} className="space-y-4">
        <Input
          label="Session code"
          value={sessionCode}
          onChange={(e) => setSessionCode(e.target.value.toUpperCase())}
          placeholder="e.g. AB1C2D"
          maxLength={8}
          required
        />
        <Button type="submit" disabled={loading || sessionCode.length < 4} className="w-full">
          {loading ? "Joining..." : "Join session"}
        </Button>
      </form>
      {status && <p className="mt-4 text-sm text-red-600">{status}</p>}
    </div>
  );
}