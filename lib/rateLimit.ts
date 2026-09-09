type Bucket = {
  count: number;
  resetAt: number;
};
 
const store = new Map<string, Bucket>();
 
/**
 * Simple in-memory sliding-window rate limiter.
 *
 * @param key      Unique key per action + identity (e.g. `login:127.0.0.1`)
 * @param limit    Maximum number of requests allowed within the window
 * @param windowMs Window duration in milliseconds
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): { ok: boolean; remaining: number } {
  const now = Date.now();
  let bucket = store.get(key);
 
  if (!bucket || now > bucket.resetAt) {
    bucket = { count: 0, resetAt: now + windowMs };
    store.set(key, bucket);
  }
 
  bucket.count += 1;
 
  if (bucket.count > limit) {
    return { ok: false, remaining: 0 };
  }
 
  return { ok: true, remaining: limit - bucket.count };
}