"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Alert } from "@/components/ui/Feedback";
import { apiFetch, errorMessage } from "@/lib/client/api";

type Role = "INSTRUCTOR" | "STUDENT";

type RegisterResponse = {
  user: { id: string; email: string; role: Role };
  verificationCode?: string;
};

function RegisterForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>(
    searchParams.get("role") === "instructor" ? "INSTRUCTOR" : "STUDENT"
  );

  const [registered, setRegistered] = useState(false);
  const [demoCode, setDemoCode] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleRegister(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setNotice(null);

    try {
      const data = await apiFetch<RegisterResponse>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, password, role })
      });

      setRegistered(true);
      setDemoCode(data.verificationCode ?? null);
      setNotice("Account created. Enter the verification code to finish.");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await apiFetch("/api/auth/verify-email", {
        method: "POST",
        body: JSON.stringify({ email, code: verificationCode })
      });
      window.location.href = "/dashboard";
    } catch (err) {
      setError(errorMessage(err));
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="mb-2 text-2xl font-semibold text-mcmaster-maroon">Create your account</h1>
      <p className="mb-6 text-sm text-slate-600">
        Registration is restricted to <span className="font-mono">@mcmaster.ca</span> addresses.
      </p>

      <form onSubmit={handleRegister} className="mb-6 space-y-4" noValidate>
        <Input
          label="McMaster email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          disabled={registered}
          placeholder="firstname.lastname@mcmaster.ca"
        />
        <Input
          label="Password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          minLength={8}
          disabled={registered}
          hint="At least 8 characters."
        />

        <fieldset disabled={registered}>
          <legend className="mb-2 text-sm font-medium text-slate-800">I am a</legend>
          <div className="flex gap-3" role="radiogroup" aria-label="Account role">
            {(
              [
                ["STUDENT", "Student"],
                ["INSTRUCTOR", "Instructor"]
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={role === value}
                onClick={() => setRole(value)}
                className={`flex-1 rounded-md border px-3 py-2 text-sm transition-colors ${
                  role === value
                    ? "border-mcmaster-maroon bg-mcmaster-maroon text-white"
                    : "border-slate-300 bg-white text-slate-800 hover:bg-slate-50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </fieldset>

        {!registered && (
          <Button type="submit" loading={loading} className="w-full">
            Create account
          </Button>
        )}
      </form>

      {registered && (
        <>
          {demoCode && (
            <div className="mb-4 rounded-md border border-mcmaster-gold bg-mcmaster-gold/10 p-4 text-sm">
              <p className="mb-1 font-semibold">Development mode</p>
              <p>
                A real deployment emails this code. Yours is{" "}
                <span className="font-mono font-semibold">{demoCode}</span>
              </p>
            </div>
          )}

          <form onSubmit={handleVerify} className="space-y-3">
            <Input
              label="Verification code"
              value={verificationCode}
              onChange={(event) => setVerificationCode(event.target.value.toUpperCase())}
              placeholder="6-character code"
              autoComplete="one-time-code"
              required
            />
            <Button type="submit" loading={loading} disabled={!verificationCode} className="w-full">
              Verify email
            </Button>
          </form>
        </>
      )}

      <div className="mt-4 space-y-3">
        {notice && !error && <Alert tone="success">{notice}</Alert>}
        {error && <Alert tone="error">{error}</Alert>}
      </div>

      <p className="mt-6 text-sm text-slate-600">
        Already registered?{" "}
        <Link href="/auth/login" className="font-medium text-mcmaster-maroon hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-md px-4 py-12 text-sm">Loading…</div>}>
      <RegisterForm />
    </Suspense>
  );
}
