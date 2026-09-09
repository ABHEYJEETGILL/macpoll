"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ApiRequestError, apiFetch } from "@/lib/client/api";

/** Only same-origin paths, so `?next=` cannot bounce a user off-site. */
function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/dashboard";
  return raw;
}

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    apiFetch<{ user: unknown }>("/api/auth/me")
      .then((data) => {
        if (data.user) router.replace("/dashboard");
      })
      .catch(() => {});
  }, [router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setStatus(null);
    try {
      await apiFetch("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password })
      });
      router.push(safeNext(searchParams.get("next")));
      router.refresh();
    } catch (err) {
      setStatus(err instanceof ApiRequestError ? err.message : "Could not sign in.");
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md px-4 py-10 mx-auto">
      <h1 className="mb-4 text-2xl font-semibold text-mcmaster-maroon">Log in</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <Input
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Signing in..." : "Sign in"}
        </Button>
      </form>
      {status && <p className="mt-4 text-sm text-red-600">{status}</p>}
    </div>
  );
}
