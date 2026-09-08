import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword, setSessionCookie, hashPassword } from "@/lib/auth";
import { route, ApiError, Errors } from "@/lib/api";
import { loginSchema } from "@/lib/validation";
import { rateLimit } from "@/lib/rateLimit";

// Comparing against a throwaway hash keeps the response time for an unknown
// email close to that of a known one, so the endpoint does not leak which
// addresses are registered.
const DUMMY_HASH_PROMISE = hashPassword("macpoll-timing-equalizer");

export const POST = route(
  {
    auth: "none",
    csrf: false,
    body: loginSchema,
    // A whole lecture hall shares one campus NAT address, so the per-IP cap is
    // loose and the meaningful brute-force limit is per account, below.
    rateLimit: { name: "login-ip", limit: 200, windowMs: 60_000 }
  },
  async ({ body }) => {
    const { email, password } = body;

    if (!rateLimit(`login-account:${email}`, 10, 60_000).ok) {
      throw Errors.tooMany();
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user?.passwordHash) {
      await verifyPassword(await DUMMY_HASH_PROMISE, password);
      throw new ApiError(401, "Incorrect email or password.");
    }

    if (!(await verifyPassword(user.passwordHash, password))) {
      throw new ApiError(401, "Incorrect email or password.");
    }

    const { csrfToken } = setSessionCookie({ userId: user.id, role: user.role, email: user.email });

    return NextResponse.json({
      user: { id: user.id, email: user.email, role: user.role, verifiedAt: user.verifiedAt },
      csrfToken
    });
  }
);
