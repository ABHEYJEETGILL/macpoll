'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { CheckCircle2, Clock, Loader2, BarChart3, Send, EyeOff } from 'lucide-react'
import { useSocket } from '@/hooks/useSocket'
import { formatDateTime } from '@/lib/utils'

interface Poll {
  id: string; title: string; question: string | null; type: string; status: string
  timerSeconds?: number; hideResults: boolean; imageUrl?: string | null
  showContentToStudents: boolean
  options: { id: string; text: string }[]
  myResponse?: { optionId?: string; shortAnswer?: string } | null
  _count: { responses: number }
}

interface AttendanceSession {
  id: string; label: string; isOpen: boolean; durationMins?: number; openedAt: string
}

interface Course {
  id: string; name: string; code: string; semester?: string
  instructor: { name: string }
}

export default function StudentCoursePage() {
  const { courseId } = useParams<{ courseId: string }>()
  const [course,     setCourse]    = useState<Course | null>(null)
  const [polls,      setPolls]     = useState<Poll[]>([])
  const [sessions,   setSessions]  = useState<AttendanceSession[]>([])
  const [loading,    setLoading]   = useState(true)
  const [selected,   setSelected]  = useState<Record<string, string>>({})
  const [textAns,    setTextAns]   = useState<Record<string, string>>({})
  const [submitting, setSubmitting]= useState<Record<string, boolean>>({})
  const [msgs,       setMsgs]      = useState<Record<string, { type: 'success'|'error'; text: string }>>({})

  const { on } = useSocket(courseId, 'STUDENT')

  const load = useCallback(async () => {
    const [cRes, pRes, aRes] = await Promise.all([
      fetch(`/api/courses/${courseId}`),
      fetch(`/api/polls?courseId=${courseId}`),
      fetch(`/api/attendance?courseId=${courseId}`),
    ])
    if (cRes.ok) setCourse(await cRes.json())
    if (pRes.ok) setPolls(await pRes.json())
    if (aRes.ok) setSessions(await aRes.json())
    setLoading(false)
  }, [courseId])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const offStart = on('poll-started', (poll: unknown) => {
      setPolls((prev) => [poll as Poll, ...prev.filter((p) => p.id !== (poll as Poll).id)])
    })
    const offEnd = on('poll-ended', ({ pollId }: unknown) => {
      setPolls((prev) => prev.map((p) => p.id === (pollId as string) ? { ...p, status: 'ENDED' } : p))
    })
    const offAttOpen = on('attendance-opened', (sess: unknown) => {
      setSessions((prev) => [sess as AttendanceSession, ...prev])
    })
    const offAttClose = on('attendance-closed', ({ sessionId }: unknown) => {
      setSessions((prev) => prev.map((s) => s.id === (sessionId as string) ? { ...s, isOpen: false } : s))
    })
    return () => { offStart(); offEnd(); offAttOpen(); offAttClose() }
  }, [on])

  async function submitPoll(pollId: string, type: string) {
    setSubmitting((p) => ({ ...p, [pollId]: true }))
    const body: Record<string, string> = { pollId }
    if (type === 'SHORT_ANSWER') body.shortAnswer = textAns[pollId] ?? ''
    else body.optionId = selected[pollId] ?? ''

    const res  = await fetch('/api/polls/respond', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    })
    const data = await res.json()
    setMsgs((p) => ({ ...p, [pollId]: { type: res.ok ? 'success' : 'error', text: res.ok ? 'Response submitted!' : data.error } }))
    if (res.ok) load()
    setSubmitting((p) => ({ ...p, [pollId]: false }))
  }

  async function markAttendance(sessionId: string) {
    setSubmitting((p) => ({ ...p, [sessionId]: true }))
    const res  = await fetch('/api/attendance/mark', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ sessionId }),
    })
    const data = await res.json()
    setMsgs((p) => ({ ...p, [sessionId]: { type: res.ok ? 'success' : 'error', text: res.ok ? 'Attendance marked!' : data.error } }))
    setSubmitting((p) => ({ ...p, [sessionId]: false }))
  }

  if (loading) return <div className="flex items-center justify-center py-24"><Loader2 size={28} className="animate-spin text-maroon-700" /></div>
  if (!course)  return <div className="py-24 text-center text-gray-500">Course not found.</div>

  const activePolls = polls.filter((p) => p.status === 'ACTIVE')
  const pastPolls   = polls.filter((p) => p.status === 'ENDED')
  const openSession = sessions.find((s) => s.isOpen)

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <span className="text-xs font-semibold text-maroon-700 bg-maroon-50 px-2 py-0.5 rounded">{course.code}</span>
        <h1 className="mt-2 text-3xl text-gray-900 font-display">{course.name}</h1>
        <p className="text-sm text-gray-500">{course.instructor.name}{course.semester ? ` · ${course.semester}` : ''}</p>
      </div>

      {/* Open Attendance */}
      {openSession && (
        <div className="p-6 card border-emerald-200 bg-emerald-50">
          <div className="flex items-center gap-3 mb-4">
            <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse-soft" />
            <h2 className="font-semibold text-emerald-900">Attendance is open</h2>
          </div>
          <p className="mb-1 text-sm text-emerald-800">{openSession.label}</p>
          {openSession.durationMins && (
            <p className="flex items-center gap-1 mb-4 text-xs text-emerald-600">
              <Clock size={12} /> Closes after {openSession.durationMins} minutes
            </p>
          )}
          {msgs[openSession.id] ? (
            <div className={`text-sm font-medium ${msgs[openSession.id].type === 'success' ? 'text-emerald-700' : 'text-red-600'}`}>
              {msgs[openSession.id].type === 'success' && <CheckCircle2 size={14} className="inline mr-1" />}
              {msgs[openSession.id].text}
            </div>
          ) : (
            <button onClick={() => markAttendance(openSession.id)} disabled={submitting[openSession.id]}
              className="btn-primary bg-emerald-600 hover:bg-emerald-700">
              {submitting[openSession.id] ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
              Mark me present
            </button>
          )}
        </div>
      )}

      {/* Active Polls */}
      {activePolls.length > 0 && (
        <div className="space-y-4">
          <h2 className="flex items-center gap-2 text-xl text-gray-900 font-display">
            <span className="w-2.5 h-2.5 bg-blue-500 rounded-full animate-pulse-soft" />
            Live Polls
          </h2>
          {activePolls.map((poll) => (
            <div key={poll.id} className="overflow-hidden border-blue-200 card">
              {/* Poll header — always shown */}
              <div className="px-6 py-4 bg-maroon-700">
                <p className="mb-1 text-xs font-semibold tracking-widest uppercase text-maroon-300">{poll.title}</p>

                {/* ── Show/hide content based on instructor setting ── */}
                {poll.showContentToStudents ? (
                  <p className="text-lg font-semibold leading-snug text-white">{poll.question}</p>
                ) : (
                  <div className="flex items-center gap-2 text-maroon-200">
                    <EyeOff size={16} />
                    <p className="text-sm italic">Look at the screen — question displayed by instructor</p>
                  </div>
                )}
              </div>

              {/* Image (only shown if showContentToStudents is true) */}
              {poll.showContentToStudents && poll.imageUrl && (
                <div className="px-6 pt-4">
                  <img
                    src={poll.imageUrl}
                    alt="Question image"
                    className="rounded-lg border border-[var(--border)] max-h-56 object-contain w-full"
                  />
                </div>
              )}

              <div className="p-6">
                {poll.myResponse ? (
                  <div className="flex items-center gap-3 text-emerald-700">
                    <CheckCircle2 size={20} />
                    <span className="font-medium">Response submitted!</span>
                  </div>
                ) : (
                  <>
                    {/* SHORT ANSWER — always show the text box even if question is hidden */}
                    {poll.type === 'SHORT_ANSWER' ? (
                      <>
                        {!poll.showContentToStudents && (
                          <p className="mb-3 text-sm italic text-gray-500">Enter your answer below.</p>
                        )}
                        <textarea
                          className="h-24 mb-4 resize-none input"
                          placeholder="Type your answer…"
                          value={textAns[poll.id] ?? ''}
                          onChange={(e) => setTextAns((p) => ({ ...p, [poll.id]: e.target.value }))}
                        />
                      </>
                    ) : poll.showContentToStudents ? (
                      /* MC/TF options — only shown if showContentToStudents */
                      <div className="grid grid-cols-1 gap-3 mb-4 sm:grid-cols-2">
                        {poll.options.map((opt) => (
                          <button key={opt.id} onClick={() => setSelected((p) => ({ ...p, [poll.id]: opt.id }))}
                            className={`flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all text-sm font-medium ${selected[poll.id] === opt.id ? 'border-maroon-700 bg-maroon-50 text-maroon-700' : 'border-[var(--border)] text-gray-700 hover:border-maroon-300'}`}>
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${selected[poll.id] === opt.id ? 'bg-maroon-700 text-white' : 'bg-gray-100 text-gray-400'}`}>
                              {String.fromCharCode(65 + poll.options.indexOf(opt))}
                            </div>
                            {opt.text}
                          </button>
                        ))}
                      </div>
                    ) : (
                      /* Hidden MC/TF — show lettered buttons without text */
                      <div className="mb-4">
                        <p className="mb-3 text-xs text-gray-400">Select your answer (A–{String.fromCharCode(64 + poll.options.length)}):</p>
                        <div className="flex flex-wrap gap-3">
                          {poll.options.map((opt, idx) => (
                            <button key={opt.id} onClick={() => setSelected((p) => ({ ...p, [poll.id]: opt.id }))}
                              className={`w-12 h-12 rounded-xl border-2 font-bold text-sm transition-all ${selected[poll.id] === opt.id ? 'border-maroon-700 bg-maroon-700 text-white' : 'border-[var(--border)] text-gray-600 hover:border-maroon-400'}`}>
                              {String.fromCharCode(65 + idx)}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {msgs[poll.id] && (
                      <p className={`text-sm mb-3 ${msgs[poll.id].type === 'error' ? 'text-red-600' : 'text-emerald-600'}`}>
                        {msgs[poll.id].text}
                      </p>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400">{poll._count.responses} responses</span>
                      <button onClick={() => submitPoll(poll.id, poll.type)} disabled={submitting[poll.id]} className="btn-primary">
                        {submitting[poll.id] ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                        Submit
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Past Polls */}
      {pastPolls.length > 0 && (
        <div>
          <h2 className="flex items-center gap-2 mb-4 text-xl text-gray-900 font-display">
            <BarChart3 size={18} /> Past Polls
          </h2>
          <div className="card divide-y divide-[var(--border)]">
            {pastPolls.map((poll) => (
              <div key={poll.id} className="flex items-center justify-between p-4">
                <div>
                  <p className="text-sm font-medium text-gray-900">{poll.title}</p>
                  <p className="text-xs text-gray-400">{poll._count.responses} responses · Ended</p>
                </div>
                {poll.myResponse
                  ? <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                  : <span className="text-xs text-gray-400">No response</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Attendance history */}
      {sessions.filter((s) => !s.isOpen).length > 0 && (
        <div>
          <h2 className="mb-4 text-xl text-gray-900 font-display">Attendance History</h2>
          <div className="card divide-y divide-[var(--border)]">
            {sessions.filter((s) => !s.isOpen).map((s) => (
              <div key={s.id} className="flex items-center justify-between p-4">
                <p className="text-sm font-medium text-gray-900">{s.label}</p>
                <p className="text-xs text-gray-400">{formatDateTime(s.openedAt)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {activePolls.length === 0 && !openSession && (
        <div className="p-12 text-center text-gray-400 card">
          <p className="text-sm">No active polls or attendance sessions right now.</p>
          <p className="mt-1 text-xs">Your instructor will start one when class is in session.</p>
        </div>
      )}
    </div>
  )
}
