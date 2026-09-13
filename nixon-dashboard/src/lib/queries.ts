// Typed reads and writes against the tables the Telegram agent already owns.
// The dashboard writes only `tasks` (status, and new rows) and `memory`.
// `daily_state`, `learning` and `messages` belong to the agent: read only.
import { supabase } from './supabase'
import { lisbonToday } from './time'
import type { Agent, DailyState, Learning, Memory, Message, Task } from '../types/db'

const unwrap = <T>({ data, error }: { data: T | null; error: { message: string } | null }): T => {
  if (error) throw new Error(error.message)
  return (data ?? []) as T
}

// ------------------------------------------------------------------- tasks
/** Everything not done, nearest deadline first, undated last. */
export async function getOpenTasks(): Promise<Task[]> {
  const rows = unwrap<Task[]>(
    await supabase.from('tasks').select('*').neq('status', 'done').order('deadline', {
      ascending: true, nullsFirst: false,
    }),
  )
  return rows
}

export async function getAllTasks(): Promise<Task[]> {
  return unwrap<Task[]>(
    await supabase.from('tasks').select('*').order('deadline', { ascending: true, nullsFirst: false }),
  )
}

export async function getTasksByAgent(agent: Agent): Promise<Task[]> {
  return unwrap<Task[]>(
    await supabase.from('tasks').select('*').eq('agent', agent).order('deadline', {
      ascending: true, nullsFirst: false,
    }),
  )
}

/** Done, and updated today in Lisbon. */
export async function getTodayDone(): Promise<Task[]> {
  const rows = unwrap<Task[]>(
    await supabase.from('tasks').select('*').eq('status', 'done').order('updated_at', { ascending: false }),
  )
  const today = lisbonToday()
  return rows.filter((t) => lisbonToday(new Date(t.updated_at)) === today)
}

export async function setTaskStatus(task_id: string, status: Task['status']): Promise<void> {
  const { error } = await supabase
    .from('tasks')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('task_id', task_id)
  if (error) throw new Error(error.message)
}

const slug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'task'

export async function addTask(input: {
  agent: Agent
  task: string
  deadline?: string | null
  priority?: string | null
}): Promise<Task> {
  const suffix = Math.random().toString(36).slice(2, 6)
  const row = {
    task_id: `${input.agent}-${slug(input.task)}-${suffix}`,
    agent: input.agent,
    task: input.task,
    deadline: input.deadline || null,
    priority: input.priority || 'medium',
    status: 'open' as const,
    updated_at: new Date().toISOString(),
  }
  const { data, error } = await supabase.from('tasks').insert(row).select().single()
  if (error) throw new Error(error.message)
  return data as Task
}

// ------------------------------------------------------------------- state
export async function getToday(): Promise<DailyState | null> {
  const { data, error } = await supabase
    .from('daily_state').select('*').eq('date', lisbonToday()).maybeSingle()
  if (error) throw new Error(error.message)
  return data as DailyState | null
}

// ---------------------------------------------------------------- learning
export async function getLearning(agent?: Agent, limit = 10): Promise<Learning[]> {
  let q = supabase.from('learning').select('*').order('created_at', { ascending: false }).limit(limit)
  if (agent) q = q.eq('agent', agent)
  return unwrap<Learning[]>(await q)
}

// ---------------------------------------------------------------- messages
/** Oldest first, so the chat reads top to bottom. */
export async function getMessages(limit = 60): Promise<Message[]> {
  const rows = unwrap<Message[]>(
    await supabase.from('messages').select('*').order('created_at', { ascending: false }).limit(limit),
  )
  return rows.slice().reverse()
}

// ------------------------------------------------------------------ memory
export async function getMemory(): Promise<Memory[]> {
  return unwrap<Memory[]>(await supabase.from('memory').select('*').order('key'))
}

export async function upsertMemory(key: string, value: string, kind: Memory['kind']): Promise<void> {
  const { error } = await supabase
    .from('memory')
    .upsert({ key, value, kind, updated_at: new Date().toISOString() }, { onConflict: 'key' })
  if (error) throw new Error(error.message)
}
