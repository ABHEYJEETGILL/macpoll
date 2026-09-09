import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { route, Errors } from "@/lib/api";
import { rateLimit } from "@/lib/rateLimit";
import { verifyEmailSchema } from "@/lib/validation";

export const POST = route(
  {
    auth: "none",
    csrf: false,
    body: verifyEmailSchema,
    rateLimit: { name: "verify-email-ip", limit: 200, windowMs: 60_000 }
  },
  async ({ body }) => {
    const { email, code } = body;

    // The code is short, so guessing is limited per address rather than per IP
    // (a campus NAT would otherwise share one budget across the whole class).
    if (!rateLimit(`verify-email-account:${email}`, 10, 60_000).ok) {
      throw Errors.tooMany();
    }

    const token = await prisma.verificationToken.findUnique({
      where: { email_token: { email, token: code } }
    });

    if (!token || token.expiresAt < new Date()) {
      throw Errors.badRequest("That code is invalid or has expired.");
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw Errors.notFound("Account");

    await prisma.$transaction([
      prisma.user.update({ where: { email }, data: { verifiedAt: new Date() } }),
      // Drop every outstanding code for this address, not just the one used.
      prisma.verificationToken.deleteMany({ where: { email } })
    ]);

    return NextResponse.json({ success: true });
  }
);
