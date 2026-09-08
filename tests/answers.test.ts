import { describe, it, expect } from "vitest";
import type { Poll } from "@prisma/client";
import { normalizeAnswer, tallyResponses, numericSummary, pollOptions } from "@/lib/answers";

function poll(overrides: Partial<Poll>): Poll {
  return {
    id: "poll_1",
    liveSessionId: "session_1",
    type: "MULTIPLE_CHOICE",
    questionText: "Question?",
    optionsJson: ["A", "B", "C"],
    isAnonymous: false,
    allowChange: true,
    timeLimitSec: null,
    createdAt: new Date(),
    openedAt: new Date(),
    closedAt: null,
    ...overrides
  } as Poll;
}

describe("normalizeAnswer", () => {
  it("accepts a listed multiple choice option", () => {
    expect(normalizeAnswer(poll({}), "B")).toBe("B");
  });

  // Previously any string was stored, so a client could invent options.
  it("rejects an option that is not on the poll", () => {
    expect(() => normalizeAnswer(poll({}), "Z")).toThrow(/not part of this poll/);
    expect(() => normalizeAnswer(poll({}), 42)).toThrow();
  });

  it("normalizes true/false in several shapes", () => {
    const tf = poll({ type: "TRUE_FALSE", optionsJson: null });
    expect(normalizeAnswer(tf, true)).toBe("True");
    expect(normalizeAnswer(tf, "true")).toBe("True");
    expect(normalizeAnswer(tf, "FALSE")).toBe("False");
    expect(() => normalizeAnswer(tf, "maybe")).toThrow();
  });

  it("coerces numeric answers and rejects non-numbers", () => {
    const numeric = poll({ type: "NUMERIC", optionsJson: null });
    expect(normalizeAnswer(numeric, "42.5")).toBe(42.5);
    expect(normalizeAnswer(numeric, 7)).toBe(7);
    expect(() => normalizeAnswer(numeric, "not a number")).toThrow(/must be a number/);
    expect(() => normalizeAnswer(numeric, Infinity)).toThrow();
  });

  it("trims short answers and rejects empty or oversized ones", () => {
    const short = poll({ type: "SHORT_ANSWER", optionsJson: null });
    expect(normalizeAnswer(short, "  hello  ")).toBe("hello");
    expect(() => normalizeAnswer(short, "   ")).toThrow(/cannot be empty/);
    expect(() => normalizeAnswer(short, "x".repeat(241))).toThrow(/too long/);
  });
});

describe("pollOptions", () => {
  it("returns True/False for boolean polls regardless of stored json", () => {
    expect(pollOptions({ type: "TRUE_FALSE", optionsJson: null })).toEqual(["True", "False"]);
  });

  it("filters non-string entries", () => {
    expect(pollOptions({ type: "MULTIPLE_CHOICE", optionsJson: ["A", 3, null, "B"] })).toEqual([
      "A",
      "B"
    ]);
  });
});

describe("tallyResponses", () => {
  it("computes percentages of the total", () => {
    const { tallies, total } = tallyResponses(
      { type: "MULTIPLE_CHOICE", optionsJson: ["A", "B"] },
      ["A", "A", "B", "A"]
    );

    expect(total).toBe(4);
    expect(tallies).toEqual([
      { label: "A", count: 3, percent: 75 },
      { label: "B", count: 1, percent: 25 }
    ]);
  });

  it("keeps zero-vote options visible", () => {
    const { tallies } = tallyResponses({ type: "MULTIPLE_CHOICE", optionsJson: ["A", "B"] }, ["A"]);
    expect(tallies.find((t) => t.label === "B")).toEqual({ label: "B", count: 0, percent: 0 });
  });

  it("ignores answers that no longer match the options", () => {
    const { tallies, total } = tallyResponses(
      { type: "MULTIPLE_CHOICE", optionsJson: ["A"] },
      ["A", "stale-option"]
    );
    expect(total).toBe(2);
    expect(tallies).toEqual([{ label: "A", count: 1, percent: 50 }]);
  });

  it("sorts free-text answers by frequency", () => {
    const { tallies } = tallyResponses({ type: "SHORT_ANSWER", optionsJson: null }, [
      "red",
      "blue",
      "red"
    ]);
    expect(tallies[0]).toMatchObject({ label: "red", count: 2 });
  });

  it("handles an empty response set", () => {
    const { tallies, total } = tallyResponses({ type: "MULTIPLE_CHOICE", optionsJson: ["A"] }, []);
    expect(total).toBe(0);
    expect(tallies).toEqual([{ label: "A", count: 0, percent: 0 }]);
  });
});

describe("numericSummary", () => {
  it("summarizes an odd-length set", () => {
    expect(numericSummary([1, 5, 3])).toEqual({ mean: 3, median: 3, min: 1, max: 5 });
  });

  it("averages the middle pair for an even-length set", () => {
    expect(numericSummary([1, 2, 3, 4])?.median).toBe(2.5);
  });

  it("returns null when there is nothing numeric", () => {
    expect(numericSummary([])).toBeNull();
    expect(numericSummary(["a", "b"])).toBeNull();
  });
});
