import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rateLimit";
import { responseSubmitSchema } from "@/lib/validation";
import { requireAuth } from "@/lib/permissions";

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ip = req.headers.get("x-forwarded-for") ?? "local";
  const rl = rateLimit(`submit-response:${ip}`, 400, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const json = await req.json().catch(() => null);
  const parsed = responseSubmitSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { pollId, answer } = parsed.data;

  const poll = await prisma.poll.findUnique({
    where: { id: pollId },
    include: { liveSession: true }
  });
  if (!poll || !poll.openedAt || poll.closedAt) {
    return NextResponse.json({ error: "Poll not accepting responses" }, { status: 400 });
  }

  // Mark attendance as present (submitted at least one response)
  await prisma.attendance.upsert({
    where: {
      liveSessionId_userId: {
        liveSessionId: poll.liveSessionId,
        userId: user.id
      }
    },
    update: {
      presentBool: true
    },
    create: {
      liveSessionId: poll.liveSessionId,
      userId: user.id,
      presentBool: true
    }
  });

  const data: any = {
    pollId,
    answerJson: answer
  };
  if (!poll.isAnonymous) {
    data.userId = user.id;
  }

  const response = await prisma.response.create({
    data
  });

  return NextResponse.json({ response }, { status: 201 });
}

