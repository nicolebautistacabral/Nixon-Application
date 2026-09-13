import { Card, ErrorNote } from '../components/Card'
import { SkeletonList } from '../components/Skeleton'
import { getAllTasks, getToday } from '../lib/queries'
import { useLive } from '../hooks/useLive'
import { asksFrom, botLink } from '../lib/phase'
import type { DailyState, Task } from '../types/db'

export default function Asks() {
  const tasks = useLive<Task[]>('tasks', getAllTasks, [])
  const state = useLive<DailyState | null>('daily_state', getToday, null)
  const asks = asksFrom(state.data, tasks.data)
  const loading = tasks.loading || state.loading
  const error = tasks.error ?? state.error

  return (
    <main className="mx-auto w-full max-w-2xl px-4 pt-6 sm:px-6">
      <h1 className="font-cursive text-4xl">Waiting on you</h1>

      <div className="mt-5 space-y-3">
        {loading ? <SkeletonList n={2} />
          : error ? <ErrorNote message={error} />
          : asks.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-4xl">✅</p>
              <p className="mt-3 text-lg font-medium">All clear. Nothing is blocked.</p>
            </Card>
          ) : asks.map((a) => (
            <Card key={a.id} className={`p-4 ${a.urgent ? 'border-red-300/50' : ''}`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="min-w-0 flex-1">
                  {a.urgent && <span className="mr-2 font-semibold text-red-200">Overdue</span>}
                  {a.text}
                </p>
                <a
                  href={botLink()} target="_blank" rel="noreferrer"
                  className="grid shrink-0 place-items-center rounded-xl bg-white/90 px-4 py-2.5 text-sm font-semibold text-nav-text transition hover:bg-white"
                >
                  Open Telegram
                </a>
              </div>
            </Card>
          ))}
      </div>
    </main>
  )
}
