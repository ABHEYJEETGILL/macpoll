import { NextResponse } from "next/server";
import { clearSessionCookies } from "@/lib/auth";
import { route } from "@/lib/api";

export const POST = route({ roles: "any" }, async () => {
  clearSessionCookies();
  return NextResponse.json({ success: true });
});
