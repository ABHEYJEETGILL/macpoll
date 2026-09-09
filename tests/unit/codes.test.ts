import { describe, expect, it } from "vitest";
import { generateCode, generateUniqueCode } from "@/lib/codes";

describe("generateCode", () => {
  it("returns the requested length", () => {
    expect(generateCode(6)).toHaveLength(6);
    expect(generateCode(10)).toHaveLength(10);
  });

  it("avoids characters that are ambiguous when read aloud", () => {
    const sample = Array.from({ length: 200 }, () => generateCode(8)).join("");
    expect(sample).not.toMatch(/[IO01]/);
  });

  it("does not repeat within a large sample", () => {
    const codes = new Set(Array.from({ length: 500 }, () => generateCode(8)));
    expect(codes.size).toBe(500);
  });
});

describe("generateUniqueCode", () => {
  it("retries until it finds a free code", async () => {
    let calls = 0;
    const code = await generateUniqueCode(async () => ++calls < 3);
    expect(code).not.toBeNull();
    expect(calls).toBe(3);
  });

  it("gives up rather than returning a duplicate", async () => {
    expect(await generateUniqueCode(async () => true, 6, 3)).toBeNull();
  });
});
