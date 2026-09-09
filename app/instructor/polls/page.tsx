"use client";

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Plus, Loader2, Play, Square, Trash2, BarChart3, Eye, EyeOff, Image, BookOpen } from 'lucide-react'
import { useSocket } from '@/hooks/useSocket'

interface Course        { id: string; name: string; code: string }
interface ClassSession  { id: string; title: string; isActive: boolean }
interface PollOption    { id: string; text: string; isCorrect: boolean }
interface Poll {
  id: string; title: string; question: string; type: string; status: string
  courseId: string; sessionId?: string
  imageUrl?: string; showContentToStudents: boolean
  course: { code: string }
  options: PollOption[]
  _count: { responses: number }
}
interface LibQuestion {
  id: string; title: string; body: string; type: string
  imageUrl?: string; showContentToStudents: boolean
  options: { id: string; text: string; isCorrect: boolean }[]
}

const defaultForm = {
  courseId: '', sessionId: '', questionId: '',
  title: '', question: '', type: 'MULTIPLE_CHOICE',
  timerSeconds: '', hideResults: false,
  imageUrl: '', showContentToStudents: true,
  options: [{ text: '', isCorrect: false }, { text: '', isCorrect: false }],
}

export default function InstructorPollsPage() {
  const [courses,    setCourses]   = useState<Course[]>([])
  const [sessions,   setSessions]  = useState<ClassSession[]>([])
  const [polls,      setPolls]     = useState<Poll[]>([])
  const [library,    setLibrary]   = useState<LibQuestion[]>([])
  const [selCourse,  setSelCourse] = useState('')
  const [loading,    setLoading]   = useState(false)
  const [showForm,   setShowForm]  = useState(false)
  const [showLib,    setShowLib]   = useState(false)
  const [form,       setForm]      = useState(defaultForm)
  const [creating,   setCreating]  = useState(false)
  const [formErr,    setFormErr]   = useState('')

  const { emit } = useSocket(selCourse, 'INSTRUCTOR')

  const loadData = useCallback(async (cid?: string) => {
    setLoading(true)
    const cRes = await fetch('/api/courses')
    if (!cRes.ok) { setLoading(false); return }
    const cs: Course[] = await cRes.json()
    setCourses(cs)

    const useCid = cid ?? selCourse ?? cs[0]?.id
    if (!useCid) { setLoading(false); return }
    setSelCourse(useCid)

    const [pRes, sRes, lRes] = await Promise.all([
      fetch(`/api/polls?courseId=${useCid}`),
      fetch(`/api/sessions?courseId=${useCid}`),
      fetch('/api/questions'),
    ])
    if (pRes.ok) setPolls(await pRes.json())
    if (sRes.ok) setSessions(await sRes.json())
    if (lRes.ok) setLibrary(await lRes.json())
    setLoading(false)
  }, [selCourse])

  useEffect(() => { loadData() }, []) // eslint-disable-line

  function setField(f: string, v: unknown) {
    setForm((p) => ({ ...p, [f]: v }))
  }

  // Prefill form from a library question
  function prefillFromLibrary(q: LibQuestion) {
    setForm((p) => ({
      ...p,
      questionId:            q.id,
      title:                 q.title,
      question:              q.body,
      type:                  q.type,
      imageUrl:              q.imageUrl ?? '',
      showContentToStudents: q.showContentToStudents,
      options: q.options.length
        ? q.options.map((o) => ({ text: o.text, isCorrect: o.isCorrect }))
        : p.options,
    }))
    setShowLib(false)
    setShowForm(true)
  }

  async function changePollStatus(pollId: string, action: 'start' | 'end') {
    const res = await fetch(`/api/polls/${pollId}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ action }),
    })
    if (res.ok) {
      const updated = await res.json()
      setPolls((prev) => prev.map((p) => p.id === pollId ? { ...p, status: updated.status } : p))
      emit(action === 'start' ? 'poll-started' : 'poll-ended', {
        courseId: selCourse,
        ...(action === 'start' ? { poll: updated } : { pollId }),
      })
    }
  }

  async function deletePoll(pollId: string) {
    if (!confirm('Delete this poll?')) return
    await fetch(`/api/polls/${pollId}`, { method: 'DELETE' })
    setPolls((prev) => prev.filter((p) => p.id !== pollId))
  }

  async function createPoll(e: React.FormEvent) {
    e.preventDefault()
    setFormErr('')
    setCreating(true)

    const body: Record<string, unknown> = {
      ...form,
      sessionId:    form.sessionId  || null,
      questionId:   form.questionId || null,
      imageUrl:     form.imageUrl   || null,
      timerSeconds: form.timerSeconds ? parseInt(form.timerSeconds) : null,
    }
    if (form.type === 'SHORT_ANSWER' || form.type === 'TRUE_FALSE') delete body.options

    const res  = await fetch('/api/polls', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok) { setFormErr(data.error); setCreating(false); return }

    setPolls((prev) => [data, ...prev])
    setShowForm(false)
    setForm({ ...defaultForm, courseId: selCourse })
    setCreating(false)
  }

  const filteredPolls = selCourse ? polls.filter((p) => p.courseId === selCourse) : polls

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl text-gray-900 font-display">Polls</h1>
          <p className="mt-1 text-sm text-gray-500">Create and manage live classroom polls.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setShowLib(!showLib); setShowForm(false) }}
            className="text-sm btn-outline">
            <BookOpen size={15} /> Question Library
          </button>
          <button onClick={() => { setShowForm(!showForm); setShowLib(false); setForm({ ...defaultForm, courseId: selCourse }) }}
            className="btn-primary">
            <Plus size={16} /> New Poll
          </button>
        </div>
      </div>

      {/* Course filter */}
      {courses.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {courses.map((c) => (
            <button key={c.id} onClick={() => loadData(c.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${selCourse === c.id ? 'bg-maroon-700 text-white' : 'bg-white border border-[var(--border)] text-gray-600 hover:border-maroon-300'}`}>
              {c.code}
            </button>
          ))}
        </div>
      )}

      {/* Library picker */}
      {showLib && (
        <div className="p-5 card border-maroon-200">
          <h2 className="flex items-center gap-2 mb-4 font-semibold text-gray-900">
            <BookOpen size={16} className="text-maroon-700" /> Your Question Library
          </h2>
          {library.length === 0 ? (
            <p className="text-sm text-gray-400">No saved questions yet. Create a poll to build your library.</p>
          ) : (
            <div className="space-y-2 overflow-y-auto max-h-72">
              {library.map((q) => (
                <div key={q.id} className="flex items-center justify-between p-3 rounded-lg border border-[var(--border)] hover:border-maroon-300 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{q.title}</p>
                    <p className="text-xs text-gray-400">{q.type.replace('_', ' ')}
                      {q.imageUrl && ' · has image'}
                      {!q.showContentToStudents && ' · content hidden from students'}
                    </p>
                  </div>
                  <button onClick={() => prefillFromLibrary(q)} className="btn-primary text-xs py-1.5 ml-3">
                    Use
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create poll form */}
      {showForm && (
        <form onSubmit={createPoll} className="p-6 space-y-5 card border-maroon-200 bg-maroon-50/20">
          <h2 className="flex items-center gap-2 font-semibold text-gray-900">
            <Plus size={16} className="text-maroon-700" /> Create Poll
          </h2>
          {formErr && <p className="px-3 py-2 text-sm text-red-600 border border-red-200 rounded-lg bg-red-50">{formErr}</p>}

          {/* Row 1 — course + session */}
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="poll-course" className="label">Course *</label>
              <select id="poll-course" className="input" value={form.courseId} onChange={(e) => { setField('courseId', e.target.value); loadData(e.target.value) }} required>
                <option value="">Select course…</option>
                {courses.map((c) => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="poll-session" className="label">Session (optional)</label>
              <select id="poll-session" className="input" value={form.sessionId} onChange={(e) => setField('sessionId', e.target.value)}>
                <option value="">No session</option>
                {sessions.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
              </select>
            </div>
          </div>

          {/* Row 2 — type + title */}
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="poll-type" className="label">Poll Type *</label>
              <select id="poll-type" className="input" value={form.type} onChange={(e) => setField('type', e.target.value)}>
                <option value="MULTIPLE_CHOICE">Multiple Choice</option>
                <option value="TRUE_FALSE">True / False</option>
                <option value="SHORT_ANSWER">Short Answer</option>
              </select>
            </div>
            <div>
              <label className="label">Title *</label>
              <input className="input" placeholder="e.g. Week 3 Check-In" value={form.title} onChange={(e) => setField('title', e.target.value)} required />
            </div>
          </div>

          {/* Question text */}
          <div>
            <label className="label">Question Text *</label>
            <textarea className="h-20 resize-none input" placeholder="What is your question?" value={form.question} onChange={(e) => setField('question', e.target.value)} required />
          </div>

          {/* Image URL */}
          <div>
            <label className="flex items-center gap-2 label">
              <Image size={13} /> Question Image URL (optional)
            </label>
            <input className="input" type="url" placeholder="https://example.com/diagram.png"
              value={form.imageUrl} onChange={(e) => setField('imageUrl', e.target.value)} />
            {form.imageUrl && (
              <img src={form.imageUrl} alt="preview" className="mt-2 max-h-32 rounded-lg border border-[var(--border)] object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
            )}
          </div>

          {/* ── Show content to students toggle ── */}
          <div className="flex items-start gap-4 p-4 rounded-xl border-2 border-[var(--border)] bg-white">
            <div className="flex-1">
              <p className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                {form.showContentToStudents
                  ? <><Eye size={15} className="text-emerald-600" /> Show question on student devices</>
                  : <><EyeOff size={15} className="text-amber-600" /> Hide question from student devices</>
                }
              </p>
              <p className="mt-1 text-xs text-gray-500">
                {form.showContentToStudents
                  ? 'Students will see the question text and image on their phone/laptop.'
                  : 'Students will see "A poll is running — look at the screen." The question and image are only visible on the projected screen.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setField('showContentToStudents', !form.showContentToStudents)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 ${form.showContentToStudents ? 'bg-emerald-500' : 'bg-gray-300'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow ${form.showContentToStudents ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          {/* Answer options (MC only) */}
          {form.type === 'MULTIPLE_CHOICE' && (
            <div className="space-y-2">
              <label className="label">Answer Options *</label>
              {form.options.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input className="flex-1 input" placeholder={`Option ${i + 1}`} value={opt.text}
                    onChange={(e) => setField('options', form.options.map((o, j) => j === i ? { ...o, text: e.target.value } : o))} required />
                  <label className="flex items-center gap-1.5 text-sm text-gray-600 shrink-0 cursor-pointer">
                    <input type="checkbox" checked={opt.isCorrect}
                      onChange={(e) => setField('options', form.options.map((o, j) => j === i ? { ...o, isCorrect: e.target.checked } : o))} />
                    Correct
                  </label>
                  {form.options.length > 2 && (
                    <button type="button" onClick={() => setField('options', form.options.filter((_, j) => j !== i))}
                      className="text-lg leading-none text-gray-300 hover:text-red-400">×</button>
                  )}
                </div>
              ))}
              {form.options.length < 6 && (
                <button type="button" onClick={() => setField('options', [...form.options, { text: '', isCorrect: false }])}
                  className="text-sm text-maroon-700 hover:underline">+ Add option</button>
              )}
            </div>
          )}

          {/* Timer + hide results */}
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label">Timer (seconds, optional)</label>
              <input className="input" type="number" min="10" max="3600" placeholder="e.g. 60"
                value={form.timerSeconds} onChange={(e) => setField('timerSeconds', e.target.value)} />
            </div>
            <div className="flex items-center gap-3 pt-6">
              <input type="checkbox" id="hideResults" checked={form.hideResults}
                onChange={(e) => setField('hideResults', e.target.checked)} className="rounded" />
              <label htmlFor="hideResults" className="text-sm text-gray-700 cursor-pointer">
                Hide results from students until poll ends
              </label>
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={creating} className="btn-primary">
              {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              Create Poll
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="btn-ghost">Cancel</button>
          </div>
        </form>
      )}

      {/* Polls list */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="animate-spin text-maroon-700" />
        </div>
      ) : filteredPolls.length === 0 ? (
        <div className="p-12 text-center card">
          <BarChart3 size={32} className="mx-auto mb-4 text-gray-300" />
          <p className="text-gray-500">No polls yet. Create one above.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredPolls.map((poll) => (
            <div key={poll.id} className="p-5 card">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className={poll.status === 'ACTIVE' ? 'badge-active' : poll.status === 'DRAFT' ? 'badge-draft' : 'badge-ended'}>
                      {poll.status === 'ACTIVE' ? '● Live' : poll.status}
                    </span>
                    <span className="text-xs text-gray-400">{poll.course.code}</span>
                    {/* Show / hide badge */}
                    <span className={`badge text-xs flex items-center gap-1 ${poll.showContentToStudents ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                      {poll.showContentToStudents
                        ? <><Eye size={10} /> Visible on devices</>
                        : <><EyeOff size={10} /> Screen-only</>}
                    </span>
                    {poll.imageUrl && (
                      <span className="flex items-center gap-1 text-xs text-blue-600 badge bg-blue-50">
                        <Image size={10} /> Image
                      </span>
                    )}
                  </div>
                  <p className="font-semibold text-gray-900 truncate">{poll.title}</p>
                  <p className="text-sm text-gray-500 mt-0.5 truncate">{poll.question}</p>
                  <p className="mt-1 text-xs text-gray-400">{poll._count.responses} responses · {poll.type.replace('_', ' ')}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {poll.status === 'DRAFT' && (
                    <button onClick={() => changePollStatus(poll.id, 'start')} className="btn-primary text-xs py-1.5">
                      <Play size={12} /> Launch
                    </button>
                  )}
                  {poll.status === 'ACTIVE' && (
                    <button onClick={() => changePollStatus(poll.id, 'end')} className="btn-outline text-xs py-1.5 border-red-300 text-red-600 hover:bg-red-50">
                      <Square size={12} /> End
                    </button>
                  )}
                  {poll.status !== 'DRAFT' && (
                    <Link href={`/instructor/polls/${poll.id}/results`} className="btn-ghost text-xs py-1.5 border border-[var(--border)]">
                      <BarChart3 size={12} /> Results
                    </Link>
                  )}
                  <button onClick={() => deletePoll(poll.id)} aria-label={`Delete poll: ${poll.title}`} className="btn-ghost text-xs py-1.5 text-gray-400 hover:text-red-500">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
