import { z } from "zod";

const secret = z
  .string()
  .min(32, "must be at least 32 characters — generate one with `openssl rand -hex 32`");

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1),
  SESSION_SECRET: secret,
  REALTIME_INTERNAL_SECRET: secret,
  REALTIME_INTERNAL_URL: z.string().url().default("http://localhost:4000"),
  REALTIME_ALLOWED_ORIGINS: z.string().default("http://localhost:3000"),
  REALTIME_PORT: z.coerce.number().int().positive().default(4000)
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

/**
 * Validates process.env on first use and fails loudly. Called lazily rather
 * than at module load so that `next build` can collect pages without secrets.
 */
export function env(): Env {
  if (cached) return cached;

  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const details = Object.entries(parsed.error.flatten().fieldErrors)
      .map(([key, errors]) => `  ${key}: ${errors?.join("; ")}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${details}`);
  }

  cached = parsed.data;
  return cached;
}

export function allowedOrigins(): string[] {
  return env()
    .REALTIME_ALLOWED_ORIGINS.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}
