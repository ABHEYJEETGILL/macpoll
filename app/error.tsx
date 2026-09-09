"use client";

import { useEffect } from "react";

// Without this, one bad render blanks the whole page - during a lecture that
// means a student loses the poll entirely rather than seeing a retry.
export default function Error({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="max-w-md px-4 py-16 mx-auto text-center">
      <h1 className="text-xl font-semibold text-slate-900">Something went wrong</h1>
      <p className="mt-2 text-sm text-slate-600">
        The page hit an unexpected error. Your answers already submitted are saved.
      </p>
      <button onClick={reset} className="mt-6 btn-primary">
        Try again
      </button>
    </div>
  );
}
