import { env } from "./env";

export type RealtimeEvent =
  | "poll-started"
  | "poll-ended"
  | "poll-progress"
  | "attendance-opened"
  | "attendance-closed";

/**
 * Publishes an event to the realtime server, which fans it out to the course
 * room. Only this server-side path can emit: the socket server ignores events
 * sent by connected clients, so a student cannot forge a poll.
 *
 * Failures are logged rather than thrown - a dropped notification must not fail
 * the request whose database write already succeeded. Clients re-fetch on load.
 */
export async function publish(
  courseId: string,
  event: RealtimeEvent,
  payload: unknown
): Promise<void> {
  try {
    const res = await fetch(`${env().REALTIME_INTERNAL_URL}/internal/publish`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-secret": env().REALTIME_INTERNAL_SECRET
      },
      body: JSON.stringify({ courseId, event, payload }),
      cache: "no-store"
    });
    if (!res.ok) {
      console.error(`Realtime publish failed (${res.status}) for ${event}`);
    }
  } catch (error) {
    console.error(`Realtime publish threw for ${event}:`, error);
  }
}
