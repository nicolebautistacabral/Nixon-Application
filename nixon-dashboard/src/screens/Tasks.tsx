import { useMemo, useState, type FormEvent } from 'react'
import TaskRow from '../components/TaskRow'
import { Card, Empty, ErrorNote } from '../components/Card'
import { SkeletonList } from '../components/Skeleton'
import { AGENTS, agentLabel } from '../lib/agents'
import { addTask, getAllTasks } from '../lib/queries'
import { useLive } from '../hooks/useLive'
import { lisbonToday } from '../lib/time'
import type { Agent, Task } from '../types/db'

type Filter = 'open' | 'in_progress' | 'done'
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'open', label: 'Open' },
  { id: 'in_progress', label: 'In progress' },
  { id: 'done', label: 'Done today' },
]

export default function Tasks() {
  const all = useLive<Task[]>('tasks', getAllTasks, [])
  const [filter, setFilter] = useState<Filter>('open')
  const [adding, setAdding] = useState(false)

  const shown = useMemo(() => {
    const today = lisbonToday()
    const rows = all.data.filter((t) =>
      filter === 'done'
        ? t.status === 'done' && lisbonToday(new Date(t.updated_at)) === today
        : t.status === filter,
    )
    const groups = new Map<string, Task[]>()
    for (const t of rows) {
      const list = groups.get(t.agent) ?? []
      list.push(t)
      groups.set(t.agent, list)
    }
    return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [all.data, filter])

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pt-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-cursive text-4xl">Tasks</h1>
        <button
          onClick={() => setAdding((v) => !v)}
          className="rounded-xl border border-white/30 bg-white/15 px-4 py-2 text-sm font-semibold backdrop-blur-md transition hover:bg-white/25"
        >
          {adding ? 'Close' : '+ Add task'}
        </button>
      </div>

      {adding && <AddTaskForm onDone={() => { setAdding(false); all.reload() }} />}

      <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`shrink-0 rounded-full border px-4 py-2 text-sm transition ${
              filter === f.id
                ? 'border-white/70 bg-white/30 font-semibold'
                : 'border-white/25 bg-white/10 hover:bg-white/20'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="mt-5 space-y-5">
        {all.loading ? <SkeletonList n={4} />
          : all.error ? <ErrorNote message={all.error} />
          : shown.length === 0 ? (
            <Empty
              title={`Nothing ${filter === 'done' ? 'finished today' : filter === 'open' ? 'open' : 'in progress'}.`}
              hint='Tell Nixon in Telegram: "Add: submit WP2 report by Friday 17:00"'
            />
          ) : shown.map(([agent, rows]) => (
            <section key={agent}>
              <h2 className="mb-2 font-sans text-xs font-semibold uppercase tracking-[0.16em] opacity-90">
                {agentLabel(agent)} · {rows.length}
              </h2>
              <Card className="divide-y divide-white/10 p-1.5">
                {rows.map((t) => <TaskRow key={t.task_id} task={t} onChanged={all.reload} />)}
              </Card>
            </section>
          ))}
      </div>
    </main>
  )
}

function AddTaskForm({ onDone }: { onDone: () => void }) {
  const [agent, setAgent] = useState<Agent>('helix')
  const [text, setText] = useState('')
  const [deadline, setDeadline] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    setBusy(true)
    setError(null)
    try {
      await addTask({
        agent,
        task: text.trim(),
        deadline: deadline ? new Date(deadline).toISOString() : null,
      })
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="mt-4 p-4">
      <form onSubmit={submit} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-[140px_1fr]">
          <select
            value={agent} onChange={(e) => setAgent(e.target.value as Agent)}
            className="rounded-xl border border-white/30 bg-white/15 px-3 py-2.5 text-white outline-none [&>option]:text-nav-text"
          >
            {AGENTS.map((a) => <option key={a.key} value={a.key}>{a.name}</option>)}
            <option value="nixon">Nixon</option>
          </select>
          <input
            value={text} onChange={(e) => setText(e.target.value)} required
            placeholder="What needs doing?"
            className="rounded-xl border border-white/30 bg-white/15 px-3 py-2.5 text-white placeholder-white/50 outline-none focus:border-white/70"
          />
        </div>
        <input
          type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)}
          className="w-full rounded-xl border border-white/30 bg-white/15 px-3 py-2.5 text-white outline-none focus:border-white/70 sm:w-auto"
        />
        {error && <p className="text-sm text-red-200">{error}</p>}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit" disabled={busy}
            className="rounded-xl bg-white/90 px-5 py-2.5 font-semibold text-nav-text transition hover:bg-white disabled:opacity-60"
          >
            {busy ? 'Saving…' : 'Save task'}
          </button>
          <p className="text-xs opacity-80">
            Added here only. Tell Nixon in Telegram if it needs a calendar event.
          </p>
        </div>
      </form>
    </Card>
  )
}
