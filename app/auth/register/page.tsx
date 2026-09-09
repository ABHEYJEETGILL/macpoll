"use client";

import { FormEvent, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import router from "next/router";

useEffect(() => {
  fetch("/api/auth/me").then(r => r.json()).then(data => {
    if (data.user) router.replace("/dashboard");
  });
}, []);
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
    <div className="max-w-md px-4 py-10 mx-auto">
      <h1 className="mb-4 text-2xl font-semibold text-mcmaster-maroon">Create your MacPoll account</h1>
      <p className="mb-6 text-sm text-slate-600">
        Registration is restricted to <span className="font-mono">@mcmaster.ca</span> email
        addresses. A one-time verification code will be sent to confirm your email.
      </p>
      <form onSubmit={handleRegister} className="mb-6 space-y-4">
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
        
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Processing..." : "Register"}
        </Button>
      </form>

      {codeSent && (
        <div className="p-4 mb-6 text-sm border rounded-md border-mcmaster-gold bg-mcmaster-gold/10">
          <p className="mb-1 font-semibold">Demo mode</p>
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

