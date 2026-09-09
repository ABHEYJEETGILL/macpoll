import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword, setSessionCookie, clearSessionCookies } from "@/lib/auth";
import { loginSchema } from "@/lib/validation";
import { rateLimit } from "@/lib/rateLimit";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "local";
  const rl = rateLimit(`login:${ip}`, 20, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const json = await req.json().catch(() => null);
  const parsed = loginSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.passwordHash) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const ok = await verifyPassword(user.passwordHash, password);
  if (!ok) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  clearSessionCookies();
  const { csrfToken } = setSessionCookie({
    id: user.id,
    role: user.role,
    email: user.email
  });

  return NextResponse.json(
    {
      user: { id: user.id, email: user.email, role: user.role, verifiedAt: user.verifiedAt },
      csrfToken
    },
    { status: 200 }
  );
}