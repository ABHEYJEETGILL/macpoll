import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const QuestionSchema = z.object({
  title:                z.string().min(2).max(120),
  body:                 z.string().min(3).max(1000),
  type:                 z.enum(['MULTIPLE_CHOICE', 'TRUE_FALSE', 'SHORT_ANSWER']),
  imageUrl:             z.string().url().optional().nullable(),
  showContentToStudents: z.boolean().default(true),
  points:               z.number().int().min(0).max(100).default(1),
  options: z.array(z.object({
    text:      z.string().min(1).max(200),
    isCorrect: z.boolean().default(false),
  })).min(2).max(6).optional(),
})

// GET /api/questions — instructor's question library
export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'INSTRUCTOR') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const questions = await prisma.question.findMany({
    where:   { instructorId: session.user.id },
    include: { options: { orderBy: { orderIndex: 'asc' } } },
    orderBy: { updatedAt: 'desc' },
  })

  return NextResponse.json(questions)
}

// POST /api/questions — create a question in the library
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'INSTRUCTOR') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body   = await req.json()
  const result = QuestionSchema.safeParse(body)
  if (!result.success)
    return NextResponse.json({ error: result.error.errors[0].message }, { status: 400 })

  const { title, body: qBody, type, imageUrl, showContentToStudents, points, options } = result.data

  let builtOptions: { text: string; isCorrect: boolean; orderIndex: number }[] = []
  if (type === 'TRUE_FALSE') {
    builtOptions = [
      { text: 'True',  isCorrect: false, orderIndex: 0 },
      { text: 'False', isCorrect: false, orderIndex: 1 },
    ]
  } else if (type === 'MULTIPLE_CHOICE' && options) {
    builtOptions = options.map((o, i) => ({ ...o, orderIndex: i }))
  }

  const question = await prisma.question.create({
    data: {
      instructorId: session.user.id,
      title,
      body: qBody,
      type,
      imageUrl:             imageUrl ?? null,
      showContentToStudents,
      points,
      options: { create: builtOptions },
    },
    include: { options: { orderBy: { orderIndex: 'asc' } } },
  })

  return NextResponse.json(question, { status: 201 })
}