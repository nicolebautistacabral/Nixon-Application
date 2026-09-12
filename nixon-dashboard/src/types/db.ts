// Mirrors supabase/migrations/0001_schema.sql. Do not add tables here that
// the Telegram agent does not own.

export type Agent = 'nixon' | 'helix' | 'cadence' | 'compass' | 'ember' | 'ledger' | 'forge'

export type Task = {
  task_id: string
  agent: Agent
  task: string
  deadline: string | null
  status: 'open' | 'in_progress' | 'done'
  priority: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type Memory = {
  key: string
  value: string
  kind: 'instruction' | 'id' | 'preference' | 'fact'
  updated_at: string
}

export type DailyState = {
  date: string
  phase: 'cadence_lesson' | 'cadence_done' | 'helix_lesson' | 'helix_quiz' | 'open' | 'closed'
  cadence_day: number
  cadence_theme: string | null
  helix_topic: string | null
  quiz_round: number
  quiz_scores: number[]
  notes: string | null
  updated_at: string
}

export type Learning = {
  id: number
  date: string
  agent: Agent
  topic: string | null
  content: string | null
  created_at: string
}

export type Message = {
  id: number
  chat_id: string
  role: 'user' | 'model'
  content: string
  created_at: string
}
