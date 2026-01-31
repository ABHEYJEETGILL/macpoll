import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromRequest } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const user = await getCurrentUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ user: null }, { status: 200 });
  }
  return NextResponse.json(
    {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        verifiedAt: user.verifiedAt
      }
    },
    { status: 200 }
  );
}

