import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, setSessionCookie, clearSessionCookies } from "@/lib/auth";
import { rateLimit } from "@/lib/rateLimit";
import { registerSchema } from "@/lib/validation";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "local";
  const rl = rateLimit(`register:${ip}`, 10, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const json = await req.json().catch(() => null);
  const parsed = registerSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { email, password, role } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "Email already registered" }, { status: 400 });
  }

  const passwordHash = await hashPassword(password);

  const user = await prisma.user.create({
    data: { email, role, passwordHash }
  });

  const token = Math.random().toString(36).slice(2, 8).toUpperCase();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 30);
  await prisma.verificationToken.create({
    data: { email, token, expiresAt }
  });

  clearSessionCookies();
  const { csrfToken } = setSessionCookie({
    id: user.id,
    role: user.role,
    email: user.email
  });

  return NextResponse.json(
    {
      user: { id: user.id, email: user.email, role: user.role, verifiedAt: user.verifiedAt },
      verificationCode: token,
      csrfToken
    },
    { status: 201 }
  );
}