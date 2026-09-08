import type { Poll } from "@prisma/client";
import { Errors } from "./api";

export const TRUE_FALSE_OPTIONS = ["True", "False"] as const;

/** Prisma stores options as loose Json; narrow it to the string list we wrote. */
export function pollOptions(poll: Pick<Poll, "type" | "optionsJson">): string[] {
  if (poll.type === "TRUE_FALSE") return [...TRUE_FALSE_OPTIONS];
  if (!Array.isArray(poll.optionsJson)) return [];
  return poll.optionsJson.filter((option): option is string => typeof option === "string");
}

export type NormalizedAnswer = string | number;

/**
 * Validates a submitted answer against the poll it belongs to and returns the
 * canonical value to store. Without this, aggregation buckets are whatever the
 * client chose to send.
 */
export function normalizeAnswer(poll: Poll, answer: unknown): NormalizedAnswer {
  switch (poll.type) {
    case "MULTIPLE_CHOICE": {
      if (typeof answer !== "string") {
        throw Errors.badRequest("Choose one of the listed options.");
      }
      const options = pollOptions(poll);
      const match = options.find((option) => option === answer);
      if (!match) throw Errors.badRequest("That option is not part of this poll.");
      return match;
    }

    case "TRUE_FALSE": {
      if (typeof answer === "boolean") return answer ? "True" : "False";
      if (typeof answer === "string") {
        const normalized = answer.trim().toLowerCase();
        if (normalized === "true") return "True";
        if (normalized === "false") return "False";
      }
      throw Errors.badRequest("Answer must be True or False.");
    }

    case "NUMERIC": {
      const value = typeof answer === "string" ? Number(answer.trim()) : answer;
      if (typeof value !== "number" || !Number.isFinite(value)) {
        throw Errors.badRequest("Answer must be a number.");
      }
      return value;
    }

    case "SHORT_ANSWER": {
      if (typeof answer !== "string") {
        throw Errors.badRequest("Answer must be text.");
      }
      const trimmed = answer.trim();
      if (trimmed.length === 0) throw Errors.badRequest("Answer cannot be empty.");
      if (trimmed.length > 240) throw Errors.badRequest("Answer is too long (240 characters max).");
      return trimmed;
    }

    default:
      throw Errors.badRequest("Unsupported poll type.");
  }
}

export type Tally = {
  label: string;
  count: number;
  percent: number;
};

/**
 * Buckets responses for display. Choice-style polls always list every option so
 * a zero-vote option still renders; free-text polls list only what was said.
 */
export function tallyResponses(
  poll: Pick<Poll, "type" | "optionsJson">,
  answers: unknown[]
): { tallies: Tally[]; total: number } {
  const counts = new Map<string, number>();

  const isChoice = poll.type === "MULTIPLE_CHOICE" || poll.type === "TRUE_FALSE";
  if (isChoice) {
    for (const option of pollOptions(poll)) counts.set(option, 0);
  }

  for (const answer of answers) {
    const label = typeof answer === "string" ? answer : JSON.stringify(answer);
    // Ignore stray values that no longer match the poll's options.
    if (isChoice && !counts.has(label)) continue;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  const total = answers.length;
  const tallies = [...counts.entries()].map(([label, count]) => ({
    label,
    count,
    percent: total === 0 ? 0 : Math.round((count / total) * 100)
  }));

  if (!isChoice) tallies.sort((a, b) => b.count - a.count);
  return { tallies, total };
}

/** Mean/median/min/max for numeric polls, shown alongside the distribution. */
export function numericSummary(answers: unknown[]): {
  mean: number;
  median: number;
  min: number;
  max: number;
} | null {
  const values = answers.filter((a): a is number => typeof a === "number" && Number.isFinite(a));
  if (values.length === 0) return null;

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0 ? (sorted[middle - 1]! + sorted[middle]!) / 2 : sorted[middle]!;

  return {
    mean: Number((values.reduce((sum, v) => sum + v, 0) / values.length).toFixed(2)),
    median,
    min: sorted[0]!,
    max: sorted[sorted.length - 1]!
  };
}
