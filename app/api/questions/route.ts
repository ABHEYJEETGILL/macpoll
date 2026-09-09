import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { route } from "@/lib/api";
import { questionCreateSchema } from "@/lib/validation";

export const GET = route({ roles: ["INSTRUCTOR", "ADMIN"] }, async ({ user }) => {
  const questions = await prisma.question.findMany({
    where: { instructorId: user.id },
    include: { options: { orderBy: { orderIndex: "asc" } } },
    orderBy: { updatedAt: "desc" }
  });
  return NextResponse.json(questions);
});

export const POST = route(
  { roles: ["INSTRUCTOR", "ADMIN"], body: questionCreateSchema },
  async ({ user, body }) => {
    const { options, ...fields } = body;

    const builtOptions =
      fields.type === "TRUE_FALSE"
        ? [
            { text: "True", isCorrect: false, orderIndex: 0 },
            { text: "False", isCorrect: false, orderIndex: 1 }
          ]
        : fields.type === "MULTIPLE_CHOICE" && options
          ? options.map((o, i) => ({ ...o, orderIndex: i }))
          : [];

    const question = await prisma.question.create({
      data: {
        ...fields,
        imageUrl: fields.imageUrl ?? null,
        instructorId: user.id,
        options: { create: builtOptions }
      },
      include: { options: { orderBy: { orderIndex: "asc" } } }
    });

    return NextResponse.json(question, { status: 201 });
  }
);
