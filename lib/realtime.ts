import { env } from "./env";

export type RealtimeEvent =
  | { type: "poll-opened"; pollId: string }
  | { type: "poll-closed"; pollId: string }
  | { type: "response-submitted"; pollId: string; total: number }
  | { type: "session-ended" };

/**
 * Publishes an event to every client in a session room via the realtime
 * server's internal endpoint. Clients are not trusted to announce poll state,
 * so this is the only path that produces poll events.
 *
 * Failures are logged and swallowed: a lecture must not stop because the
 * websocket process is down, and every page also polls as a fallback.
 */
export async function publish(sessionCode: string, event: RealtimeEvent): Promise<void> {
  const { REALTIME_INTERNAL_URL, REALTIME_INTERNAL_SECRET } = env();

  try {
    const response = await fetch(`${REALTIME_INTERNAL_URL}/internal/broadcast`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-macpoll-internal-secret": REALTIME_INTERNAL_SECRET
      },
      body: JSON.stringify({ sessionCode, event }),
      signal: AbortSignal.timeout(2000),
      cache: "no-store"
    });

    if (!response.ok) {
      console.warn(`Realtime publish rejected (${response.status}) for ${event.type}`);
    }
  } catch (error) {
    console.warn(`Realtime publish failed for ${event.type}:`, (error as Error).message);
  }
}
