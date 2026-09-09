import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const CreatePollSchema = z.object({
  courseId:             z.string().cuid(),
  sessionId:            z.string().cuid().optional().nullable(),
  questionId:           z.string().cuid().optional().nullable(), // link to library question
  title:                z.string().min(2).max(120),
  question:             z.string().min(5).max(1000),
  type:                 z.enum(['MULTIPLE_CHOICE', 'TRUE_FALSE', 'SHORT_ANSWER']),
  timerSeconds:         z.number().int().min(10).max(3600).optional().nullable(),
  hideResults:          z.boolean().default(false),
  imageUrl:             z.string().url().optional().nullable(),
  showContentToStudents: z.boolean().default(true),
  options: z.array(z.object({
    text:      z.string().min(1).max(200),
    isCorrect: z.boolean().default(false),
  })).min(2).max(6).optional(),
})

// GET /api/polls?courseId=xxx&sessionId=xxx
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const courseId  = req.nextUrl.searchParams.get('courseId')
  const sessionId = req.nextUrl.searchParams.get('sessionId')
  if (!courseId) return NextResponse.json({ error: 'courseId is required.' }, { status: 400 })

  const { id: userId, role } = session.user

  if (role === 'STUDENT') {
    const enrolled = await prisma.enrollment.findUnique({
      where: { studentId_courseId: { studentId: userId, courseId } },
    })
    if (!enrolled) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (role === 'INSTRUCTOR') {
    const course = await prisma.course.findFirst({ where: { id: courseId, instructorId: userId } })
    if (!course) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const where: Record<string, unknown> = { courseId }
  if (sessionId) where.sessionId = sessionId

  const polls = await prisma.poll.findMany({
    where,
    include: {
      options: { orderBy: { orderIndex: 'asc' } },
      _count:  { select: { responses: true } },
    },
    orderBy: [{ sessionId: 'asc' }, { orderIndex: 'asc' }, { createdAt: 'desc' }],
  })

  // Students: strip correct answers and apply showContentToStudents
  if (role === 'STUDENT') {
    const myResponses = await prisma.pollResponse.findMany({
      where:  { studentId: userId, poll: { courseId } },
      select: { pollId: true, optionId: true, shortAnswer: true },
    })
    const respMap = Object.fromEntries(myResponses.map((r) => [r.pollId, r]))

    return NextResponse.json(
      polls.map((poll) => ({
        ...poll,
        // Remove isCorrect from options always; hide question content if toggled off
        options: poll.showContentToStudents
          ? poll.options.map(({ isCorrect: _, ...opt }) => opt)
          : [],
        question:   poll.showContentToStudents ? poll.question : null,
        imageUrl:   poll.showContentToStudents ? poll.imageUrl  : null,
        myResponse: respMap[poll.id] ?? null,
      }))
    )
  }

  return NextResponse.json(polls)
}

// POST /api/polls
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'INSTRUCTOR') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body   = await req.json()
  const result = CreatePollSchema.safeParse(body)
  if (!result.success)
    return NextResponse.json({ error: result.error.errors[0].message }, { status: 400 })

  const {
    courseId, sessionId, questionId, title, question, type,
    timerSeconds, hideResults, imageUrl, showContentToStudents, options,
  } = result.data

  const course = await prisma.course.findFirst({ where: { id: courseId, instructorId: session.user.id } })
  if (!course) return NextResponse.json({ error: 'Course not found or access denied.' }, { status: 403 })

  // Figure out order index within the session
  let orderIndex = 0
  if (sessionId) {
    const count = await prisma.poll.count({ where: { sessionId } })
    orderIndex = count
  }

  let pollOptions: { text: string; isCorrect: boolean; orderIndex: number }[] = []
  if (type === 'TRUE_FALSE') {
    pollOptions = [
      { text: 'True',  isCorrect: false, orderIndex: 0 },
      { text: 'False', isCorrect: false, orderIndex: 1 },
    ]
  } else if (type === 'MULTIPLE_CHOICE' && options) {
    pollOptions = options.map((o, i) => ({ ...o, orderIndex: i }))
  }

  const poll = await prisma.poll.create({
    data: {
      courseId,
      sessionId:             sessionId ?? null,
      questionId:            questionId ?? null,
      title,
      question,
      type,
      timerSeconds,
      hideResults,
      imageUrl:              imageUrl ?? null,
      showContentToStudents,
      orderIndex,
      status: 'DRAFT',
      options: { create: pollOptions },
    },
    include: { options: { orderBy: { orderIndex: 'asc' } } },
  })

  return NextResponse.json(poll, { status: 201 })
}