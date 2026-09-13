import type { DailyState, Task } from '../types/db'

/** The agent owns the state machine. The dashboard only translates it. */
export function phaseInEnglish(state: DailyState | null, openCount: number): string {
  if (!state) return "Today hasn't started yet. Nixon opens it at 07:00."
  switch (state.phase) {
    case 'cadence_lesson':
      return "Waiting for your DONE on this morning's Portuguese"
    case 'cadence_done':
      return 'Portuguese done. Round-up next.'
    case 'helix_lesson':
      return "Waiting for your DONE on Helix's rabbit hole"
    case 'helix_quiz':
      return `Quiz — round ${state.quiz_round || 1} of 5`
    case 'open':
      return openCount === 0 ? 'Open — nothing left' : `Open — ${openCount} ${openCount === 1 ? 'task' : 'tasks'} left`
    case 'closed':
      return 'Closed ✅'
  }
}

export type Ask = { id: string; text: string; urgent: boolean }

/** Derived, never stored. Nothing here creates a table. */
export function asksFrom(state: DailyState | null, tasks: Task[], now = new Date()): Ask[] {
  const out: Ask[] = []
  if (state?.phase === 'cadence_lesson') {
    out.push({ id: 'cadence', text: "Reply DONE to this morning's Portuguese lesson", urgent: false })
  }
  if (state?.phase === 'helix_lesson') {
    out.push({ id: 'helix', text: "Reply DONE to Helix's rabbit hole", urgent: false })
  }
  if (state?.phase === 'helix_quiz') {
    out.push({ id: 'quiz', text: `Quiz round ${state.quiz_round || 1} of 5 is waiting`, urgent: false })
  }
  for (const t of tasks) {
    if (t.status === 'done' || !t.deadline) continue
    if (new Date(t.deadline).getTime() < now.getTime()) {
      out.push({ id: t.task_id, text: t.task, urgent: true })
    }
  }
  return out
}

export const botLink = () => {
  const u = import.meta.env.VITE_BOT_USERNAME
  return u ? `https://t.me/${u.replace(/^@/, '')}` : 'https://t.me'
}
