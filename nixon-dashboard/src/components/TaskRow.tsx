import { useState } from 'react'
import { agentColor, agentLabel } from '../lib/agents'
import { formatDeadline } from '../lib/time'
import { setTaskStatus } from '../lib/queries'
import type { Task } from '../types/db'

export default function TaskRow({ task, onChanged }: { task: Task; onChanged?: () => void }) {
  const [busy, setBusy] = useState(false)
  const deadline = formatDeadline(task.deadline)
  const done = task.status === 'done'

  async function toggle() {
    setBusy(true)
    try {
      await setTaskStatus(task.task_id, done ? 'open' : 'done')
      onChanged?.()
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={busy}
      className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-white/10 disabled:opacity-60"
    >
      <span
        aria-hidden
        className="h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: agentColor(task.agent) }}
      />
      <span className="shrink-0 text-lg leading-none">{done ? '☑' : '☐'}</span>
      <span className="min-w-0 flex-1">
        <span className={`block truncate ${done ? 'line-through opacity-60' : ''}`}>{task.task}</span>
        <span className="block text-xs opacity-70">
          {agentLabel(task.agent)}
          {deadline.label && ' · '}
          {deadline.label && (
            <span className={deadline.overdue ? 'font-semibold text-red-200' : ''}>{deadline.label}</span>
          )}
        </span>
      </span>
    </button>
  )
}
