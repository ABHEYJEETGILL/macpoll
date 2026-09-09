import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { rateLimit, resetRateLimits } from "@/lib/rateLimit";
import { prisma, buildRequest, readJson, createUser, resetDatabase } from "./helpers";
import { POST as login } from "@/app/api/auth/login/route";

beforeEach(() => resetRateLimits());
afterAll(async () => prisma.$disconnect());

describe("rateLimit", () => {
  it("allows up to the limit then blocks", () => {
    for (let i = 0; i < 3; i += 1) expect(rateLimit("k", 3, 1000).ok).toBe(true);
    expect(rateLimit("k", 3, 1000).ok).toBe(false);
  });

  it("keeps separate buckets per key", () => {
    expect(rateLimit("a", 1, 1000).ok).toBe(true);
    expect(rateLimit("a", 1, 1000).ok).toBe(false);
    expect(rateLimit("b", 1, 1000).ok).toBe(true);
  });

  it("resets after the window elapses", () => {
    vi.useFakeTimers();
    try {
      expect(rateLimit("w", 1, 1000).ok).toBe(true);
      expect(rateLimit("w", 1, 1000).ok).toBe(false);
      vi.advanceTimersByTime(1500);
      expect(rateLimit("w", 1, 1000).ok).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});

// A lecture hall shares one campus NAT address, so brute-force protection has
// to bite per account rather than per IP.
describe("login throttling", () => {
  it("throttles one account without locking out other students", async () => {
    await resetDatabase();
    const victim = await createUser("STUDENT");
    const bystander = await createUser("STUDENT");

    const attempt = (email: string, password: string) =>
      login(
        buildRequest("/api/auth/login", {
          method: "POST",
          user: null,
          body: { email, password }
        })
      );

    let throttled = false;
    for (let i = 0; i < 12; i += 1) {
      const res = await attempt(victim.email, "wrong-password");
      if (res.status === 429) throttled = true;
    }
    expect(throttled).toBe(true);

    // A different account from the same IP must still be served. A wrong
    // password is used deliberately: the success path sets a cookie via
    // next/headers, which needs a real request scope this harness lacks. 401
    // (credentials checked) rather than 429 (throttled) is the point here.
    const other = await readJson(await attempt(bystander.email, "also-wrong"));
    expect(other.status).toBe(401);
  });
});
