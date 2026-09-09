import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// PATCH /api/sessions/[sessionId]  — activate or deactivate
export async function PATCH(req: NextRequest, { params }: { params: { sessionId: string } }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'INSTRUCTOR') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { action } = await req.json() // 'activate' | 'deactivate'
  const { sessionId } = params

  const classSession = await prisma.classSession.findUnique({
    where:   { id: sessionId },
    include: { course: true },
  })
  if (!classSession) return NextResponse.json({ error: 'Session not found.' }, { status: 404 })
  if (classSession.course.instructorId !== session.user.id)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  if (action === 'activate') {
    // Deactivate any other active session in this course first
    await prisma.classSession.updateMany({
      where: { courseId: classSession.courseId, isActive: true },
      data:  { isActive: false },
    })
    const updated = await prisma.classSession.update({
      where: { id: sessionId },
      data:  { isActive: true },
    })
    return NextResponse.json(updated)
  }

  if (action === 'deactivate') {
    const updated = await prisma.classSession.update({
      where: { id: sessionId },
      data:  { isActive: false },
    })
    return NextResponse.json(updated)
  }

  return NextResponse.json({ error: 'Invalid action.' }, { status: 400 })
}

// DELETE /api/sessions/[sessionId]
export async function DELETE(_req: NextRequest, { params }: { params: { sessionId: string } }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'INSTRUCTOR') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const classSession = await prisma.classSession.findUnique({
    where:   { id: params.sessionId },
    include: { course: true },
  })
  if (!classSession) return NextResponse.json({ error: 'Session not found.' }, { status: 404 })
  if (classSession.course.instructorId !== session.user.id)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await prisma.classSession.delete({ where: { id: params.sessionId } })
  return NextResponse.json({ message: 'Session deleted.' })
}