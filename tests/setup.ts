import { beforeAll } from "vitest";

Object.assign(process.env, { NODE_ENV: "test" });
process.env.SESSION_SECRET ??= "test-session-secret-that-is-long-enough-01";
process.env.REALTIME_INTERNAL_SECRET ??= "test-realtime-secret-that-is-long-enough-1";
process.env.REALTIME_INTERNAL_URL ??= "http://localhost:4000";
process.env.REALTIME_ALLOWED_ORIGINS ??= "http://localhost:3000";

beforeAll(() => {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL must be set to run the test suite.");
  }
});
