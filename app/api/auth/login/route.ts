import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clearSessionCookies, setSessionCookie, verifyPassword } from "@/lib/auth";
import { ApiError, Errors, route } from "@/lib/api";
import { rateLimit } from "@/lib/rateLimit";
import { loginSchema } from "@/lib/validation";

export const POST = route({ body: loginSchema }, async ({ body }) => {
  const { email, password } = body;

  // Keyed per account, not per IP: a lecture hall shares one campus NAT
  // address and per-IP throttling would lock out the whole class.
  if (!rateLimit(`login:${email}`, 10, 60_000).ok) {
    throw Errors.tooMany("Too many sign-in attempts. Try again in a minute.");
  }

  const invalid = new ApiError(401, "Invalid email or password.");

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw invalid;
  if (!(await verifyPassword(user.password, password))) throw invalid;
  if (user.suspended) throw Errors.forbidden("This account has been suspended.");

  clearSessionCookies();
  const { csrfToken } = setSessionCookie({
    id: user.id,
    role: user.role,
    email: user.email
  });

  return NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      emailVerified: user.emailVerified
    },
    csrfToken
  });
});
