import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rateLimit";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "local";
  const rl = rateLimit(`verify:${ip}`, 20, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const { email, code } = await req.json().catch(() => ({ email: "", code: "" }));
  if (!email || !code) {
    return NextResponse.json({ error: "Missing email or code" }, { status: 400 });
  }

  const token = await prisma.verificationToken.findFirst({
    where: { email, token: code }
  });

  if (!token || token.expiresAt < new Date()) {
    return NextResponse.json({ error: "Invalid or expired code" }, { status: 400 });
  }

  await prisma.user.update({
    where: { email },
    data: { verifiedAt: new Date() }
  });

  await prisma.verificationToken.delete({
    where: { id: token.id }
  });

  return NextResponse.json({ success: true });
}

