import { describe, it, expect } from "vitest";
import {
  createSessionToken,
  verifySessionToken,
  readCookie,
  safeEqual,
  SESSION_COOKIE
} from "@/lib/session-token";

const payload = {
  userId: "user_123",
  role: "STUDENT" as const,
  email: "student@mcmaster.ca"
};

describe("session tokens", () => {
  it("round-trips a valid token", () => {
    const verified = verifySessionToken(createSessionToken(payload));
    expect(verified).toMatchObject(payload);
    expect(verified?.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it("rejects a tampered payload", () => {
    const token = createSessionToken(payload);
    const [, signature] = token.split(".");
    const forged = Buffer.from(
      JSON.stringify({ ...payload, role: "INSTRUCTOR", iat: 0, exp: 9_999_999_999 })
    ).toString("base64url");

    expect(verifySessionToken(`${forged}.${signature}`)).toBeNull();
  });

  // The original implementation called timingSafeEqual on unequal-length
  // buffers, which throws a RangeError instead of rejecting the token.
  it("rejects a short signature without throwing", () => {
    const [body] = createSessionToken(payload).split(".");
    expect(() => verifySessionToken(`${body}.abc`)).not.toThrow();
    expect(verifySessionToken(`${body}.abc`)).toBeNull();
  });

  it("rejects malformed tokens", () => {
    for (const token of ["", "onlyonepart", "a.b.c", "..", "!!!.???"]) {
      expect(verifySessionToken(token)).toBeNull();
    }
  });

  it("rejects an expired token", () => {
    expect(verifySessionToken(createSessionToken(payload, -10))).toBeNull();
  });
});

describe("safeEqual", () => {
  it("compares equal strings", () => {
    expect(safeEqual("abc123", "abc123")).toBe(true);
  });

  it("returns false for different lengths instead of throwing", () => {
    expect(() => safeEqual("short", "a-much-longer-value")).not.toThrow();
    expect(safeEqual("short", "a-much-longer-value")).toBe(false);
  });
});

describe("readCookie", () => {
  it("reads a cookie among several", () => {
    const header = `theme=dark; ${SESSION_COOKIE}=abc.def; other=1`;
    expect(readCookie(header, SESSION_COOKIE)).toBe("abc.def");
  });

  // Splitting on every "=" truncated base64 payloads in the original code.
  it("keeps values containing equals signs intact", () => {
    expect(readCookie("token=aGVsbG8=world=", "token")).toBe("aGVsbG8=world=");
  });

  it("returns null when absent", () => {
    expect(readCookie("a=1; b=2", "missing")).toBeNull();
    expect(readCookie("", "missing")).toBeNull();
  });
});
