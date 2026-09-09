"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ApiRequestError, apiFetch } from "@/lib/client/api";

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const presetRole = searchParams.get("role");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"INSTRUCTOR" | "STUDENT">(
    presetRole === "instructor" ? "INSTRUCTOR" : "STUDENT"
  );
  const [codeSent, setCodeSent] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    apiFetch<{ user: unknown }>("/api/auth/me")
      .then((data) => {
        if (data.user) router.replace("/dashboard");
      })
      .catch(() => {});
  }, [router]);

  async function handleRegister(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setStatus(null);
    try {
      const data = await apiFetch<{ verificationCode: string }>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ name, email, password, role })
      });
      setStatus("Registered. Enter the verification code below.");
      setCodeSent(data.verificationCode);
    } catch (err) {
      setStatus(err instanceof ApiRequestError ? err.message : "Registration failed.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setStatus(null);
    try {
      await apiFetch("/api/auth/verify-email", {
        method: "POST",
        body: JSON.stringify({ code: verificationCode })
      });
      setStatus("Email verified. Redirecting...");
      router.push("/dashboard");
    } catch (err) {
      setStatus(err instanceof ApiRequestError ? err.message : "Verification failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md px-4 py-10 mx-auto">
      <h1 className="mb-4 text-2xl font-semibold text-mcmaster-maroon">
        Create your MacPoll account
      </h1>
      <p className="mb-6 text-sm text-slate-600">
        Registration is restricted to <span className="font-mono">@mcmaster.ca</span> email
        addresses. A one-time verification code confirms your email.
      </p>

      <form onSubmit={handleRegister} className="mb-6 space-y-4">
        <Input
          label="Full name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
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

        <fieldset>
          <legend className="block mb-1 text-sm font-medium text-slate-700">I am a</legend>
          <div className="flex gap-4">
            {(["STUDENT", "INSTRUCTOR"] as const).map((r) => (
              <label key={r} className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="radio"
                  name="role"
                  value={r}
                  checked={role === r}
                  onChange={() => setRole(r)}
                />
                {r === "STUDENT" ? "Student" : "Instructor"}
              </label>
            ))}
          </div>
        </fieldset>

        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Processing..." : "Register"}
        </Button>
      </form>

      {codeSent && (
        <div className="p-4 mb-6 text-sm border rounded-md border-mcmaster-gold bg-mcmaster-gold/10">
          <p className="mb-1 font-semibold">Demo mode</p>
          <p>
            A real deployment emails this code. For local testing it is:{" "}
            <span className="font-mono font-semibold">{codeSent}</span>
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
        <Button
          type="submit"
          disabled={loading || !verificationCode}
          className="w-full"
          variant="secondary"
        >
          Verify email
        </Button>
      </form>

      {status && <p className="mt-4 text-sm text-slate-700">{status}</p>}
    </div>
  );
}

export default function RegisterPage() {
  // useSearchParams needs a Suspense boundary to prerender.
  return (
    <Suspense fallback={<div className="max-w-md px-4 py-10 mx-auto text-sm">Loading...</div>}>
      <RegisterForm />
    </Suspense>
  );
}
