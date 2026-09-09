import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.test" });
loadEnv();

// Deterministic secrets so signed tokens are comparable across runs.
process.env.SESSION_SECRET ??= "test-session-secret-0123456789abcdef0123456789abcdef";
process.env.REALTIME_INTERNAL_SECRET ??= "test-realtime-secret-0123456789abcdef0123456789abcdef";
process.env.REALTIME_INTERNAL_URL ??= "http://localhost:4999";

if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}
