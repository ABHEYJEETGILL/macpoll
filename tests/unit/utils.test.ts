import { describe, expect, it } from "vitest";
import { sanitizeText } from "@/lib/utils";

describe("sanitizeText", () => {
  it("collapses whitespace and trims", () => {
    expect(sanitizeText("  a   b  ")).toBe("a b");
  });

  it("strips control characters", () => {
    expect(sanitizeText("a\u0000b\u0007c\u001Fd")).toBe("a b c d");
  });

  it("preserves ordinary punctuation", () => {
    expect(sanitizeText("Yes - it's 42!")).toBe("Yes - it's 42!");
  });
});
