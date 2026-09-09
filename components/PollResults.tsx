import { EmptyState } from "@/components/ui/Feedback";

export type Tally = { label: string; count: number; percent: number };

export type PollResult = {
  pollId: string;
  type: "MULTIPLE_CHOICE" | "TRUE_FALSE" | "SHORT_ANSWER" | "NUMERIC";
  questionText: string;
  isOpen: boolean;
  tallies: Tally[];
  total: number;
  numeric: { mean: number; median: number; min: number; max: number } | null;
};

/**
 * Bars are sized by share of responses. The original chart used `count * 20`
 * as a percentage width, so five votes filled the bar regardless of turnout.
 */
export function PollResults({ result }: { result: PollResult }) {
  if (result.total === 0) {
    return <EmptyState title="No responses yet">Answers appear here as they arrive.</EmptyState>;
  }

  return (
    <div className="space-y-3">
      {result.numeric && (
        <dl className="grid grid-cols-4 gap-2 rounded-md bg-slate-50 p-2 text-center">
          {(
            [
              ["Mean", result.numeric.mean],
              ["Median", result.numeric.median],
              ["Min", result.numeric.min],
              ["Max", result.numeric.max]
            ] as const
          ).map(([label, value]) => (
            <div key={label}>
              <dt className="text-[11px] uppercase tracking-wide text-slate-500">{label}</dt>
              <dd className="text-sm font-semibold text-slate-900">{value}</dd>
            </div>
          ))}
        </dl>
      )}

      <ul className="space-y-2">
        {result.tallies.map((tally) => (
          <li key={tally.label}>
            <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
              <span className="truncate font-medium text-slate-800" title={tally.label}>
                {tally.label}
              </span>
              <span className="shrink-0 tabular-nums text-xs text-slate-600">
                {tally.count} · {tally.percent}%
              </span>
            </div>
            <div
              className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100"
              role="meter"
              aria-valuenow={tally.percent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${tally.label}: ${tally.count} responses, ${tally.percent} percent`}
            >
              <div
                className="h-full rounded-full bg-mcmaster-maroon transition-[width] duration-300 ease-out"
                style={{ width: `${tally.percent}%` }}
              />
            </div>
          </li>
        ))}
      </ul>

      <p className="text-xs text-slate-500">
        {result.total} {result.total === 1 ? "response" : "responses"}
      </p>
    </div>
  );
}
