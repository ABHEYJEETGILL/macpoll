"use client";

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

function readCsrfToken(): string | null {
  if (typeof document === "undefined") return null;
  for (const part of document.cookie.split(";")) {
    const trimmed = part.trim();
    if (trimmed.startsWith("macpoll_csrf=")) {
      return decodeURIComponent(trimmed.slice("macpoll_csrf=".length));
    }
  }
  return null;
}

/**
 * Single entry point for API calls: attaches the double-submit CSRF header on
 * mutations and turns error payloads into thrown ApiRequestErrors so callers
 * can use try/catch instead of checking res.ok everywhere.
 */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method ?? "GET").toUpperCase();
  const headers = new Headers(init.headers);

  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (method !== "GET" && method !== "HEAD") {
    const csrf = readCsrfToken();
    if (csrf) headers.set("x-macpoll-csrf", csrf);
  }

  const response = await fetch(path, { ...init, headers, credentials: "same-origin" });

  if (response.status === 204) return undefined as T;

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      typeof payload?.error === "string" ? payload.error : `Request failed (${response.status})`;
    throw new ApiRequestError(response.status, message);
  }

  return payload as T;
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) return error.message;
  if (error instanceof Error) return error.message;
  return "Something went wrong.";
}
