import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { route } from "@/lib/api";

export const GET = route({ roles: "any" }, async ({ user }) => {
  const found = await prisma.user.findUnique({
    where: { id: user.id },
    select: { id: true, name: true, email: true, role: true, emailVerified: true }
  });
  return NextResponse.json({ user: found ?? null });
});
