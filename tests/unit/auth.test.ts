import { beforeEach, describe, expect, it } from "vitest";
import { cookieJar, signIn, signOut } from "../helpers";
import { verifyCsrf } from "@/lib/auth";

describe("CSRF tokens", () => {
  beforeEach(() => signOut());

  it("accepts the token derived from the current session", () => {
    const session = signIn({ id: "u1", role: "STUDENT", email: "a@mcmaster.ca" });
    expect(verifyCsrf(session.csrf)).toBe(true);
  });

  it("rejects a missing token", () => {
    signIn({ id: "u1", role: "STUDENT", email: "a@mcmaster.ca" });
    expect(verifyCsrf(null)).toBe(false);
    expect(verifyCsrf("")).toBe(false);
  });

  it("rejects a token minted for a different session", () => {
    const other = signIn({ id: "u2", role: "STUDENT", email: "b@mcmaster.ca" });
    signIn({ id: "u1", role: "STUDENT", email: "a@mcmaster.ca" });
    expect(verifyCsrf(other.csrf)).toBe(false);
  });

  it("rejects a token of a different length without throwing", () => {
    signIn({ id: "u1", role: "STUDENT", email: "a@mcmaster.ca" });
    expect(() => verifyCsrf("short")).not.toThrow();
    expect(verifyCsrf("short")).toBe(false);
  });

  it("rejects when there is no session at all", () => {
    cookieJar.clear();
    expect(verifyCsrf("anything")).toBe(false);
  });
});
