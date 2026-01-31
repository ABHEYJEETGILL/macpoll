"use client";

import { FormEvent, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export default function RegisterPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const presetRole = searchParams.get("role");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"INSTRUCTOR" | "STUDENT">(
    presetRole === "instructor" ? "INSTRUCTOR" : "STUDENT"
  );
  const [codeSent, setCodeSent] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleRegister(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email, password, role })
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus(data.error?.formErrors?.join(" ") ?? data.error ?? "Registration failed");
      } else {
        setStatus("Registered. Check email for code (shown below for demo).");
        setCodeSent(data.verificationCode);
      }
    } catch (err) {
      console.error(err);
      setStatus("Unexpected error");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code: verificationCode })
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus(data.error ?? "Verification failed");
      } else {
        setStatus("Email verified. Redirecting to dashboard...");
        setTimeout(() => router.push("/dashboard"), 1000);
      }
    } catch (err) {
      console.error(err);
      setStatus("Unexpected error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <h1 className="mb-4 text-2xl font-semibold text-mcmaster-maroon">Create your MacPoll account</h1>
      <p className="mb-6 text-sm text-slate-600">
        Registration is restricted to <span className="font-mono">@mcmaster.ca</span> email
        addresses. A one-time verification code will be sent to confirm your email.
      </p>
      <form onSubmit={handleRegister} className="space-y-4 mb-6">
        <Input
          label="McMaster email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          placeholder="firstname.lastname@mcmaster.ca"
        />
        <Input
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
        />
        <div className="text-sm">
          <span className="font-medium text-slate-800">Role</span>
          <div className="mt-2 flex gap-3">
            <button
              type="button"
              className={`flex-1 rounded-md border px-3 py-2 text-sm ${
                role === "INSTRUCTOR"
                  ? "border-mcmaster-maroon bg-mcmaster-maroon text-white"
                  : "border-slate-300 bg-white text-slate-800"
              }`}
              onClick={() => setRole("INSTRUCTOR")}
            >
              Instructor
            </button>
            <button
              type="button"
              className={`flex-1 rounded-md border px-3 py-2 text-sm ${
                role === "STUDENT"
                  ? "border-mcmaster-maroon bg-mcmaster-maroon text-white"
                  : "border-slate-300 bg-white text-slate-800"
              }`}
              onClick={() => setRole("STUDENT")}
            >
              Student
            </button>
          </div>
        </div>
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Processing..." : "Register"}
        </Button>
      </form>

      {codeSent && (
        <div className="mb-6 rounded-md border border-mcmaster-gold bg-mcmaster-gold/10 p-4 text-sm">
          <p className="font-semibold mb-1">Demo mode</p>
          <p>
            In a real deployment this code would be emailed. For local testing your verification code
            is: <span className="font-mono font-semibold">{codeSent}</span>
          </p>
        </div>
      )}

      <form onSubmit={handleVerify} className="space-y-3">
        <Input
          label="Verification code"
          value={verificationCode}
          onChange={(e) => setVerificationCode(e.target.value.toUpperCase())}
          placeholder="Enter 6-character code"
        />
        <Button type="submit" disabled={loading || !verificationCode} className="w-full" variant="secondary">
          Verify email
        </Button>
      </form>

      {status && <p className="mt-4 text-sm text-slate-700">{status}</p>}
    </div>
  );
}

