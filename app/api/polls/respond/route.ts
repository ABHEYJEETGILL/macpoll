import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { SubmitPollResponseSchema } from '@/lib/validations'
import { sanitizeText } from '@/lib/utils'

// POST /api/polls/respond
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'STUDENT')
    return NextResponse.json({ error: 'Only students can respond to polls.' }, { status: 403 })

  const body = await req.json()
  const result = SubmitPollResponseSchema.safeParse(body)
  if (!result.success)
    return NextResponse.json({ error: result.error.errors[0].message }, { status: 400 })

  const { pollId, optionId, shortAnswer } = result.data
  const studentId = session.user.id

  const poll = await prisma.poll.findUnique({
    where:   { id: pollId },
    include: { course: true, options: true },
  })

  if (!poll) return NextResponse.json({ error: 'Poll not found.' }, { status: 404 })
  if (poll.status !== 'ACTIVE')
    return NextResponse.json({ error: 'This poll is not currently active.' }, { status: 400 })

  const enrolled = await prisma.enrollment.findUnique({
    where: { studentId_courseId: { studentId, courseId: poll.courseId } },
  })
  if (!enrolled)
    return NextResponse.json({ error: 'You are not enrolled in this course.' }, { status: 403 })

  // Prevent duplicate final submission
  const existing = await prisma.pollResponse.findUnique({
    where: { studentId_pollId: { studentId, pollId } },
  })
  if (existing)
    return NextResponse.json({ error: 'You have already responded to this poll.' }, { status: 409 })

  // Validate answer type
  if (poll.type === 'SHORT_ANSWER') {
    if (!shortAnswer?.trim())
      return NextResponse.json({ error: 'A text answer is required.' }, { status: 400 })
  } else {
    if (!optionId)
      return NextResponse.json({ error: 'Please select an option.' }, { status: 400 })
    if (!poll.options.find((o) => o.id === optionId))
      return NextResponse.json({ error: 'Invalid option.' }, { status: 400 })
  }

  const cleanAnswer = poll.type === 'SHORT_ANSWER' ? sanitizeText(shortAnswer!) : null
  const chosenOption = poll.type !== 'SHORT_ANSWER' ? optionId : null

  // Write both the final response and the audit log entry atomically
  await prisma.$transaction([
    prisma.pollResponse.create({
      data: {
        studentId,
        pollId,
        optionId:    chosenOption ?? null,
        shortAnswer: cleanAnswer,
      },
    }),
    prisma.pollResponseLog.create({
      data: {
        studentId,
        pollId,
        optionId:    chosenOption ?? null,
        shortAnswer: cleanAnswer,
      },
    }),
  ])

  return NextResponse.json({ message: 'Response submitted.' }, { status: 201 })
}