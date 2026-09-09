import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { Errors, route } from "@/lib/api";
import { rateLimit } from "@/lib/rateLimit";

const schema = z.object({ code: z.string().min(1).max(16) });

export const POST = route({ roles: "any", body: schema }, async ({ user, body }) => {
  if (!rateLimit(`verify:${user.id}`, 10, 60_000).ok) {
    throw Errors.tooMany("Too many attempts. Try again in a minute.");
  }

  const found = await prisma.user.findUnique({ where: { id: user.id } });
  if (!found) throw Errors.notFound("Account");
  if (found.emailVerified) return NextResponse.json({ success: true });

  if (!found.verificationToken || found.verificationToken !== body.code.toUpperCase()) {
    throw Errors.badRequest("Invalid verification code.");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { emailVerified: true, verificationToken: null }
  });

  return NextResponse.json({ success: true });
});
