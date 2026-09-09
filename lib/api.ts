import { NextRequest, NextResponse } from "next/server";
import { ZodError, ZodSchema } from "zod";
import { CSRF_HEADER, Role, SessionPayload, getSessionPayload, verifyCsrf } from "./auth";
import { rateLimit } from "./rateLimit";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
  }
}

export const Errors = {
  unauthorized: () => new ApiError(401, "You must be signed in."),
  forbidden: (msg = "You do not have access to this.") => new ApiError(403, msg),
  notFound: (what = "Resource") => new ApiError(404, `${what} not found.`),
  badRequest: (msg: string) => new ApiError(400, msg),
  conflict: (msg: string) => new ApiError(409, msg),
  tooMany: (msg = "Too many requests. Please slow down.") => new ApiError(429, msg)
};

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

type Ctx<TBody, TParams> = {
  req: NextRequest;
  params: TParams;
  user: SessionPayload;
  body: TBody;
};

type RouteConfig<TBody> = {
  /** Require a session. When roles are given, the session role must be one of them. */
  roles?: Role[] | "any";
  /** Defaults to true for mutating methods when a session is required. */
  csrf?: boolean;
  body?: ZodSchema<TBody>;
  rateLimit?: { limit: number; windowMs: number; scope: string };
};

/**
 * Wraps a route handler so that session lookup, role checks, CSRF verification,
 * rate limiting and body validation all happen in one place. Endpoints cannot
 * silently omit one of them.
 */
export function route<TBody = unknown, TParams = Record<string, string>>(
  config: RouteConfig<TBody>,
  handler: (ctx: Ctx<TBody, TParams>) => Promise<Response> | Response
) {
  return async (req: NextRequest, routeCtx?: { params: TParams }): Promise<Response> => {
    try {
      const needsAuth = config.roles !== undefined;
      let user = null as SessionPayload | null;

      if (needsAuth) {
        user = getSessionPayload();
        if (!user) throw Errors.unauthorized();
        if (config.roles !== "any" && !config.roles!.includes(user.role)) {
          throw Errors.forbidden();
        }
      }

      const csrfRequired = config.csrf ?? (needsAuth && MUTATING.has(req.method));
      if (csrfRequired && !verifyCsrf(req.headers.get(CSRF_HEADER))) {
        throw Errors.forbidden("Invalid or missing CSRF token.");
      }

      if (config.rateLimit) {
        // Keyed per account when signed in, else per client address. A lecture
        // hall shares one NAT address, so per-IP keying would lock out a class.
        const identity = user?.id ?? clientAddress(req);
        const { limit, windowMs, scope } = config.rateLimit;
        if (!rateLimit(`${scope}:${identity}`, limit, windowMs).ok) {
          throw Errors.tooMany();
        }
      }

      let body = undefined as TBody;
      if (config.body) {
        const raw = await req.json().catch(() => {
          throw Errors.badRequest("Request body must be valid JSON.");
        });
        body = config.body.parse(raw);
      }

      return await handler({
        req,
        params: (routeCtx?.params ?? {}) as TParams,
        user: user as SessionPayload,
        body
      });
    } catch (error) {
      return toResponse(error);
    }
  };
}

export function clientAddress(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

function toResponse(error: unknown): Response {
  if (error instanceof ApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: error.errors[0]?.message ?? "Invalid request." },
      { status: 400 }
    );
  }
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code: string }).code;
    if (code === "P2002") {
      return NextResponse.json({ error: "That already exists." }, { status: 409 });
    }
    if (code === "P2025") {
      return NextResponse.json({ error: "Resource not found." }, { status: 404 });
    }
  }
  console.error("Unhandled API error:", error);
  return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
}
