import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const CreateSessionSchema = z.object({
  courseId:    z.string().cuid(),
  title:       z.string().min(2).max(120),
  description: z.string().max(500).optional(),
  date:        z.string().datetime().optional(),
})

// GET /api/sessions?courseId=xxx
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const courseId = req.nextUrl.searchParams.get('courseId')
  if (!courseId) return NextResponse.json({ error: 'courseId required.' }, { status: 400 })

  const sessions = await prisma.classSession.findMany({
    where:   { courseId },
    include: {
      polls: {
        include: { _count: { select: { responses: true } } },
        orderBy: { orderIndex: 'asc' },
      },
      _count: { select: { polls: true } },
    },
    orderBy: { date: 'desc' },
  })

  return NextResponse.json(sessions)
}

// POST /api/sessions — instructor creates a session
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'INSTRUCTOR') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body   = await req.json()
  const result = CreateSessionSchema.safeParse(body)
  if (!result.success) return NextResponse.json({ error: result.error.errors[0].message }, { status: 400 })

  const { courseId, title, description, date } = result.data

  const course = await prisma.course.findFirst({ where: { id: courseId, instructorId: session.user.id } })
  if (!course) return NextResponse.json({ error: 'Course not found.' }, { status: 403 })

  const classSession = await prisma.classSession.create({
    data: {
      courseId,
      title,
      description,
      date: date ? new Date(date) : new Date(),
    },
    include: { _count: { select: { polls: true } } },
  })

  return NextResponse.json(classSession, { status: 201 })
}