import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import TaskRow from '../components/TaskRow'
import { Card, Empty, ErrorNote, SectionTitle } from '../components/Card'
import { SkeletonList } from '../components/Skeleton'
import { byKey } from '../lib/agents'
import { getLearning, getTasksByAgent } from '../lib/queries'
import { useLive } from '../hooks/useLive'
import { formatDay } from '../lib/time'
import type { Agent, Learning, Task } from '../types/db'

export default function AgentDetail() {
  const { name = '' } = useParams()
  const def = byKey(name)
  const key = (def?.key ?? 'nixon') as Agent

  const tasks = useLive<Task[]>('tasks', () => getTasksByAgent(key), [])
  const showLessons = key === 'helix' || key === 'cadence'
  const learning = useLive<Learning[]>('learning', () => (showLessons ? getLearning(key, 10) : Promise.resolve([])), [])

  if (!def) {
    return (
      <main className="mx-auto max-w-2xl px-4 pt-6">
        <p>No agent called “{name}”.</p>
        <Link to="/" className="inline-link mt-3 inline-block underline">Back home</Link>
      </main>
    )
  }

  const open = tasks.data.filter((t) => t.status !== 'done')
  const done = tasks.data.filter((t) => t.status === 'done').slice(0, 8)

  return (
    <main className="mx-auto w-full max-w-2xl px-4 pt-6 sm:px-6">
      <Link to="/" className="inline-link text-sm opacity-80 underline">← Home</Link>

      <div className="mt-3 flex items-center gap-3">
        <span className="h-4 w-4 rounded-full" style={{ backgroundColor: def.color, boxShadow: `0 0 18px ${def.color}` }} />
        <h1 className="font-cursive text-4xl">{def.name}</h1>
        <span className="text-sm opacity-75">{def.role}</span>
      </div>

      <section className="mt-6">
        <SectionTitle>Open · {open.length}</SectionTitle>
        {tasks.loading ? <SkeletonList n={2} />
          : tasks.error ? <ErrorNote message={tasks.error} />
          : open.length === 0
            ? <Empty title="Nothing open." hint={`Tell Nixon: "Add: ... for ${def.name}"`} />
            : <Card className="divide-y divide-white/10 p-1.5">
                {open.map((t) => <TaskRow key={t.task_id} task={t} onChanged={tasks.reload} />)}
              </Card>}
      </section>

      {done.length > 0 && (
        <section className="mt-6">
          <SectionTitle>Recently done</SectionTitle>
          <Card className="divide-y divide-white/10 p-1.5">
            {done.map((t) => <TaskRow key={t.task_id} task={t} onChanged={tasks.reload} />)}
          </Card>
        </section>
      )}

      {showLessons && (
        <section className="mt-6">
          <SectionTitle>Lessons</SectionTitle>
          {learning.loading ? <SkeletonList n={2} />
            : learning.data.length === 0
              ? <Empty title="No lessons logged yet." hint="They appear after your first morning round with Nixon." />
              : <div className="space-y-2">{learning.data.map((l) => <LessonCard key={l.id} row={l} />)}</div>}
        </section>
      )}
    </main>
  )
}

function LessonCard({ row }: { row: Learning }) {
  const [open, setOpen] = useState(false)
  return (
    <Card>
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{row.topic || 'Lesson'}</span>
          <span className="block text-xs opacity-70">{formatDay(row.created_at)}</span>
        </span>
        <span aria-hidden className="opacity-70">{open ? '−' : '+'}</span>
      </button>
      {open && row.content && (
        <p className="whitespace-pre-wrap border-t border-white/10 px-4 py-3 text-sm opacity-95">{row.content}</p>
      )}
    </Card>
  )
}
