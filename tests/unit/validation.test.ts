import { describe, expect, it } from "vitest";
import { loginSchema, registerSchema, submitPollResponseSchema } from "@/lib/validation";

describe("registerSchema", () => {
  it("rejects non-McMaster addresses", () => {
    const result = registerSchema.safeParse({
      name: "A", email: "a@gmail.com", password: "password1", role: "STUDENT"
    });
    expect(result.success).toBe(false);
  });

  it("lowercases the email", () => {
    const result = registerSchema.parse({
      name: "A", email: "A.B@McMaster.ca", password: "password1", role: "STUDENT"
    });
    expect(result.email).toBe("a.b@mcmaster.ca");
  });

  it("rejects short passwords", () => {
    const result = registerSchema.safeParse({
      name: "A", email: "a@mcmaster.ca", password: "short", role: "STUDENT"
    });
    expect(result.success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("accepts a valid McMaster login", () => {
    expect(loginSchema.safeParse({ email: "a@mcmaster.ca", password: "x" }).success).toBe(true);
  });
});

describe("submitPollResponseSchema", () => {
  const id = "clx0000000000000000000000";

  it("requires an answer of some kind", () => {
    expect(submitPollResponseSchema.safeParse({ pollId: id }).success).toBe(false);
  });

  it("accepts an option choice", () => {
    expect(submitPollResponseSchema.safeParse({ pollId: id, optionId: id }).success).toBe(true);
  });

  it("accepts a short answer", () => {
    expect(submitPollResponseSchema.safeParse({ pollId: id, shortAnswer: "hi" }).success).toBe(true);
  });
});
