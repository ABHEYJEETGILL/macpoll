import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth";
import { route } from "@/lib/api";

export const POST = route({ auth: "none", csrf: false }, async () => {
  clearSessionCookie();
  return NextResponse.json({ success: true });
});
