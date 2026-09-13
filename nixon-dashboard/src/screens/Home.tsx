import { useMemo } from 'react'
import Logo from '../components/Logo'
// three.js is ~600kB and only Home needs it, so SafeBrain loads it after first
// paint and falls back to a plain orb if it fails.
import SafeBrain from '../components/SafeBrain'
import AgentBubble from '../components/AgentBubble'
import TaskRow from '../components/TaskRow'
import { Card, Empty, ErrorNote, SectionTitle } from '../components/Card'
import { SkeletonList } from '../components/Skeleton'
import { AGENTS } from '../lib/agents'
import { getOpenTasks, getToday } from '../lib/queries'
import { useLive } from '../hooks/useLive'
import { phaseInEnglish } from '../lib/phase'
import type { DailyState, Task } from '../types/db'

export default function Home() {
  const tasks = useLive<Task[]>('tasks', getOpenTasks, [])
  const state = useLive<DailyState | null>('daily_state', getToday, null)

  const counts = useMemo(() => {
    const now = Date.now()
    const map: Record<string, { open: number; overdue: boolean }> = {}
    for (const a of AGENTS) map[a.key] = { open: 0, overdue: false }
    for (const t of tasks.data) {
      const c = map[t.agent]
      if (!c) continue
      c.open++
      if (t.deadline && new Date(t.deadline).getTime() < now) c.overdue = true
    }
    return map
  }, [tasks.data])

  const waiting = state.data?.phase === 'helix_quiz' || state.data?.phase === 'cadence_lesson'

  return (
    <main className="mx-auto w-full max-w-5xl px-4 sm:px-6">
      <header className="pt-6 sm:pt-8"><Logo /></header>

      {/* desktop: brain centred with bubbles absolutely placed around it */}
      <div className="relative mt-4 hidden h-[560px] lg:block">
        <div className="absolute left-1/2 top-1/2 w-[500px] -translate-x-1/2 -translate-y-1/2">
          <SafeBrain pulsing={waiting} />
        </div>
        {AGENTS.map((a) => (
          <AgentBubble
            key={a.key} agent={a} positioned
            openCount={counts[a.key]?.open ?? 0}
            hasOverdue={counts[a.key]?.overdue ?? false}
          />
        ))}
      </div>

      {/* mobile: brain, then a 2-column grid */}
      <div className="lg:hidden">
        <div className="mx-auto mt-2 w-[280px] max-w-full">
          <SafeBrain pulsing={waiting} />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4">
          {AGENTS.map((a) => (
            <AgentBubble
              key={a.key} agent={a}
              openCount={counts[a.key]?.open ?? 0}
              hasOverdue={counts[a.key]?.overdue ?? false}
            />
          ))}
        </div>
      </div>

      <section className="mt-8">
        <SectionTitle>Today</SectionTitle>
        {state.error ? <ErrorNote message={state.error} /> : (
          <Card className="p-5">
            <p className="text-lg font-medium">{phaseInEnglish(state.data, tasks.data.length)}</p>
            {state.data && (
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
                <div><dt className="opacity-70">Lesson day</dt><dd>{state.data.cadence_day}</dd></div>
                {state.data.cadence_theme && (
                  <div><dt className="opacity-70">Theme</dt><dd>{state.data.cadence_theme}</dd></div>
                )}
                {state.data.helix_topic && (
                  <div className="col-span-2 sm:col-span-1">
                    <dt className="opacity-70">Rabbit hole</dt><dd>{state.data.helix_topic}</dd>
                  </div>
                )}
              </dl>
            )}
          </Card>
        )}
      </section>

      <section className="mt-6">
        <SectionTitle>Working on it</SectionTitle>
        {tasks.loading ? <SkeletonList n={3} />
          : tasks.error ? <ErrorNote message={tasks.error} />
          : tasks.data.length === 0 ? (
            <Empty title="Nothing open." hint='Tell Nixon in Telegram: "Add: submit WP2 report by Friday 17:00"' />
          ) : (
            <Card className="divide-y divide-white/10 p-1.5">
              {tasks.data.slice(0, 6).map((t) => (
                <TaskRow key={t.task_id} task={t} onChanged={tasks.reload} />
              ))}
            </Card>
          )}
      </section>
    </main>
  )
}
