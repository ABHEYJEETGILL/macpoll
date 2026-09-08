import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, setSessionCookie } from "@/lib/auth";
import { route, Errors } from "@/lib/api";
import { registerSchema } from "@/lib/validation";
import { generateCode } from "@/lib/codes";
import { isProduction } from "@/lib/env";

export const POST = route(
  {
    auth: "none",
    csrf: false,
    body: registerSchema,
    // Loose per-IP cap: an entire class registering shares a campus NAT address.
    rateLimit: { name: "register", limit: 100, windowMs: 60_000 }
  },
  async ({ body }) => {
    const { email, password, role } = body;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw Errors.conflict("An account already exists for that email. Try signing in.");
    }

    const user = await prisma.user.create({
      data: { email, role, passwordHash: await hashPassword(password) }
    });

    const verificationCode = generateCode();
    await prisma.verificationToken.create({
      data: {
        email,
        token: verificationCode,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000)
      }
    });

    const { csrfToken } = setSessionCookie({ userId: user.id, role: user.role, email: user.email });

    return NextResponse.json(
      {
        user: { id: user.id, email: user.email, role: user.role, verifiedAt: user.verifiedAt },
        csrfToken,
        // Stand-in for an email provider. Never expose the code in production.
        verificationCode: isProduction() ? undefined : verificationCode
      },
      { status: 201 }
    );
  }
);
