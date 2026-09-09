import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clearSessionCookies, hashPassword, setSessionCookie } from "@/lib/auth";
import { Errors, clientAddress, route } from "@/lib/api";
import { generateCode } from "@/lib/codes";
import { rateLimit } from "@/lib/rateLimit";
import { registerSchema } from "@/lib/validation";

export const POST = route({ body: registerSchema }, async ({ req, body }) => {
  const { name, email, password, role } = body;

  if (!rateLimit(`register:${clientAddress(req)}`, 20, 60 * 60_000).ok) {
    throw Errors.tooMany("Too many sign-ups from this network. Try again later.");
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw Errors.conflict("That email is already registered.");

  const user = await prisma.user.create({
    data: {
      name,
      email,
      role,
      password: await hashPassword(password),
      verificationToken: generateCode(6)
    }
  });

  clearSessionCookies();
  const { csrfToken } = setSessionCookie({
    id: user.id,
    role: user.role,
    email: user.email
  });

  return NextResponse.json(
    {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        emailVerified: user.emailVerified
      },
      // Returned only because this build has no mail transport wired up; a
      // real deployment emails this instead of putting it in the response.
      verificationCode: user.verificationToken,
      csrfToken
    },
    { status: 201 }
  );
});
