import { NextRequest, NextResponse } from "next/server";
import type { User } from "@prisma/client";
import { z } from "zod";
import { prisma } from "./prisma";
import { getSessionFromRequest, hasValidCsrf } from "./auth";
import { rateLimit } from "./rateLimit";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const Errors = {
  unauthorized: () => new ApiError(401, "You must be signed in."),
  forbidden: (message = "You do not have access to this resource.") => new ApiError(403, message),
  notFound: (what = "Resource") => new ApiError(404, `${what} not found.`),
  badRequest: (message: string, details?: unknown) => new ApiError(400, message, details),
  conflict: (message: string) => new ApiError(409, message),
  tooMany: () => new ApiError(429, "Too many requests. Please slow down.")
};

type Role = "INSTRUCTOR" | "STUDENT";

type RateLimitConfig = { limit: number; windowMs: number; name: string };

type RouteConfig<TBody> = {
  /** "none" skips the session check entirely. */
  auth?: "none" | "any" | Role;
  // Input side is deliberately loose: schemas using .default() or .transform()
  // have an input type that differs from TBody, which is the parsed output.
  body?: z.ZodType<TBody, z.ZodTypeDef, unknown>;
  rateLimit?: RateLimitConfig;
  /** Mutating routes require the double-submit CSRF header by default. */
  csrf?: boolean;
};

export type RouteContext<TBody, TParams> = {
  req: NextRequest;
  body: TBody;
  params: TParams;
  user: User;
};

/**
 * The caller's IP. Behind a proxy this trusts X-Forwarded-For, which is only
 * meaningful when the app sits behind one that overwrites the header.
 */
function clientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

function errorResponse(error: unknown): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json(
      { error: error.message, details: error.details ?? undefined },
      { status: error.status }
    );
  }

  console.error("Unhandled API error:", error);
  return NextResponse.json({ error: "Something went wrong on our end." }, { status: 500 });
}

/**
 * Wraps a route handler with session lookup, role checks, CSRF enforcement,
 * rate limiting and body validation so no individual route can forget one.
 */
export function route<TBody = undefined, TParams = Record<string, string>>(
  config: RouteConfig<TBody>,
  handler: (ctx: RouteContext<TBody, TParams>) => Promise<NextResponse> | NextResponse
) {
  return async (req: NextRequest, routeArgs?: { params: TParams }): Promise<NextResponse> => {
    try {
      const authMode = config.auth ?? "any";
      const isMutation = req.method !== "GET" && req.method !== "HEAD";

      let user: User | null = null;
      if (authMode !== "none") {
        const session = getSessionFromRequest(req);
        if (!session) throw Errors.unauthorized();

        user = await prisma.user.findUnique({ where: { id: session.userId } });
        if (!user) throw Errors.unauthorized();

        // A role change since the token was issued invalidates it.
        if (user.role !== session.role) throw Errors.unauthorized();
        if (authMode !== "any" && user.role !== authMode) {
          throw Errors.forbidden(`This action requires ${authMode.toLowerCase()} access.`);
        }
      }

      const csrfRequired = config.csrf ?? (isMutation && authMode !== "none");
      if (csrfRequired && !hasValidCsrf(req)) {
        throw new ApiError(403, "Invalid or missing CSRF token. Try reloading the page.");
      }

      if (config.rateLimit) {
        const identity = user ? `user:${user.id}` : `ip:${clientIp(req)}`;
        const { ok } = rateLimit(
          `${config.rateLimit.name}:${identity}`,
          config.rateLimit.limit,
          config.rateLimit.windowMs
        );
        if (!ok) throw Errors.tooMany();
      }

      let body = undefined as TBody;
      if (config.body) {
        const raw = await req.json().catch(() => undefined);
        const parsed = config.body.safeParse(raw);
        if (!parsed.success) {
          throw Errors.badRequest(
            firstIssueMessage(parsed.error) ?? "Please check the values you submitted.",
            parsed.error.flatten()
          );
        }
        body = parsed.data;
      }

      return await handler({
        req,
        body,
        params: (routeArgs?.params ?? ({} as TParams)) as TParams,
        user: user as User
      });
    } catch (error) {
      return errorResponse(error);
    }
  };
}

function firstIssueMessage(error: z.ZodError): string | null {
  const issue = error.issues[0];
  if (!issue) return null;
  const path = issue.path.join(".");
  return path ? `${path}: ${issue.message}` : issue.message;
}
