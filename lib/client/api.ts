"use client";

const CSRF_COOKIE = "macpoll_csrf";

function readCsrfToken(): string {
  const match = document.cookie.match(/(?:^|;\s*)macpoll_csrf=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : "";
}

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
  }
}

/**
 * fetch wrapper that attaches the CSRF token on mutating requests and turns a
 * non-2xx response into an ApiRequestError carrying the server's message.
 */
export async function apiFetch<T = unknown>(
  input: string,
  init: RequestInit = {}
): Promise<T> {
  const method = (init.method ?? "GET").toUpperCase();
  const headers = new Headers(init.headers);

  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (method !== "GET" && method !== "HEAD") {
    headers.set("x-csrf-token", readCsrfToken());
  }

  const res = await fetch(input, { ...init, headers, credentials: "same-origin" });

  if (res.status === 204) return undefined as T;

  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    const message =
      (payload && typeof payload === "object" && "error" in payload
        ? String((payload as { error: unknown }).error)
        : null) ?? `Request failed (${res.status})`;
    throw new ApiRequestError(res.status, message);
  }
  return payload as T;
}

export { CSRF_COOKIE };
