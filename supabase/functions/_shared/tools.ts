// Nixon's tool declarations + executors (all writes go through the service-role client).
import { Type, type FunctionDeclaration } from 'npm:@google/genai@2'
import { db } from './db.ts'
import type { ToolExecutor } from './gemini.ts'
import { runSubagent } from './subagents.ts'
import type { LisbonNow } from './time.ts'

const AGENTS = ['nixon', 'helix', 'cadence', 'compass', 'ember', 'ledger', 'forge']
const STATUSES = ['open', 'in_progress', 'done']
const PHASES = ['cadence_lesson', 'cadence_done', 'helix_lesson', 'helix_quiz', 'open', 'closed']
const KINDS = ['instruction', 'id', 'preference', 'fact']

const str = (description: string) => ({ type: Type.STRING, description })
const int = (description: string) => ({ type: Type.INTEGER, description })

export const NIXON_TOOLS: FunctionDeclaration[] = [
  {
    name: 'read_tasks',
    description: 'List tasks. Omit filters for everything. Sorted by deadline (nulls last).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        status: { type: Type.STRING, enum: STATUSES, description: 'Filter by status' },
        agent: { type: Type.STRING, enum: AGENTS, description: 'Filter by agent' },
      },
    },
  },
  {
    name: 'upsert_task',
    description: 'Create or update a task. Reuse the same task_id to update (e.g. mark done).',
    parameters: {
      type: Type.OBJECT,
      required: ['task_id', 'agent', 'task'],
      properties: {
        task_id: str('Stable slug, e.g. helix-wp2-report'),
        agent: { type: Type.STRING, enum: AGENTS },
        task: str('Short imperative description'),
        deadline: str('ISO-8601 with offset, e.g. 2026-09-18T17:00:00+01:00. Omit if none.'),
        status: { type: Type.STRING, enum: STATUSES },
        priority: str('low | medium | high'),
        notes: str('Optional details'),
      },
    },
  },
  {
    name: 'read_memory',
    description: 'Return every memory row (instructions, ids, preferences, facts).',
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: 'upsert_memory',
    description: 'Store or update one memory row.',
    parameters: {
      type: Type.OBJECT,
      required: ['key', 'value', 'kind'],
      properties: {
        key: str('Dotted key, e.g. helix.lab_logbook_sheet_id or rule.confirm_before_sending'),
        value: str('The value to remember'),
        kind: { type: Type.STRING, enum: KINDS },
      },
    },
  },
  {
    name: 'read_state',
    description: "Read the daily_state row for a Lisbon date (YYYY-MM-DD). Returns null if none.",
    parameters: {
      type: Type.OBJECT,
      required: ['date'],
      properties: { date: str('YYYY-MM-DD') },
    },
  },
  {
    name: 'upsert_state',
    description: 'Create or update the daily_state row for a date. Only provided fields change.',
    parameters: {
      type: Type.OBJECT,
      required: ['date'],
      properties: {
        date: str('YYYY-MM-DD'),
        phase: { type: Type.STRING, enum: PHASES },
        cadence_day: int('Running count of lesson days'),
        cadence_theme: str('Theme of today\'s Portuguese lesson'),
        helix_topic: str('Topic of today\'s Helix lesson'),
        quiz_round: int('1-5 during the quiz'),
        quiz_scores: { type: Type.ARRAY, items: { type: Type.INTEGER }, description: 'Scores so far, /10 each' },
        notes: str('Free notes'),
      },
    },
  },
  {
    name: 'append_learning',
    description: 'Log a lesson summary (what was taught / learned) for later recall.',
    parameters: {
      type: Type.OBJECT,
      required: ['date', 'agent', 'topic', 'content'],
      properties: {
        date: str('YYYY-MM-DD'),
        agent: { type: Type.STRING, enum: AGENTS },
        topic: str('Short topic label'),
        content: str('Summary text'),
      },
    },
  },
  {
    name: 'read_learning',
    description: 'Read past lesson logs, newest first.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        agent: { type: Type.STRING, enum: AGENTS },
        date: str('YYYY-MM-DD'),
        limit: int('Max rows, default 20'),
      },
    },
  },
  {
    name: 'delegate',
    description: 'Send a self-contained request to a domain subagent and get its answer.',
    parameters: {
      type: Type.OBJECT,
      required: ['agent', 'request'],
      properties: {
        agent: { type: Type.STRING, enum: AGENTS.filter((a) => a !== 'nixon') },
        request: str('Everything the subagent needs, in one message'),
      },
    },
  },
  {
    name: 'think',
    description: 'Private scratchpad. Write a thought; it is returned unchanged.',
    parameters: {
      type: Type.OBJECT,
      required: ['thought'],
      properties: { thought: str('Your reasoning') },
    },
  },
]

function fail(error: unknown): never {
  throw error instanceof Error ? error : new Error(String(error))
}

/** Message header carrying the two reads Nixon would otherwise spend requests on.
 *  `kind` is "CHAT MESSAGE from Nicole" or "SCHEDULED PULSE <mode>". */
export async function buildHeader(kind: string, now: LisbonNow): Promise<string> {
  const [memory, state] = await Promise.all([
    db.from('memory').select('key, value, kind').order('key'),
    db.from('daily_state').select('*').eq('date', now.date).maybeSingle(),
  ])

  const memoryLines = (memory.data ?? []).map((m) => `${m.key} [${m.kind}] = ${m.value}`)
  const memoryBlock = memory.error
    ? `(memory unavailable: ${memory.error.message} — call read_memory yourself)`
    : memoryLines.length
    ? memoryLines.join('\n')
    : '(empty — she has not told you anything to remember yet)'

  const stateBlock = state.error
    ? `(state unavailable: ${state.error.message} — call read_state yourself)`
    : state.data
    ? JSON.stringify(state.data)
    : `(no row for ${now.date} yet — today has not started)`

  return [
    `[${kind} | ${now.label} | today=${now.date} (${now.weekday})]`,
    `MEMORY:`,
    memoryBlock,
    `TODAY'S STATE (${now.date}):`,
    stateBlock,
    `---`,
  ].join('\n')
}

export const executeNixonTool: ToolExecutor = async (name, a) => {
  switch (name) {
    case 'read_tasks': {
      let q = db.from('tasks').select('*').order('deadline', { ascending: true, nullsFirst: false })
      if (a.status) q = q.eq('status', a.status as string)
      if (a.agent) q = q.eq('agent', a.agent as string)
      const { data, error } = await q
      if (error) fail(error)
      return data
    }
    case 'upsert_task': {
      const row: Record<string, unknown> = { updated_at: new Date().toISOString() }
      for (const k of ['task_id', 'agent', 'task', 'deadline', 'status', 'priority', 'notes']) {
        if (a[k] !== undefined && a[k] !== null && a[k] !== '') row[k] = a[k]
      }
      const { data, error } = await db.from('tasks').upsert(row, { onConflict: 'task_id' }).select().single()
      if (error) fail(error)
      return data
    }
    case 'read_memory': {
      const { data, error } = await db.from('memory').select('*').order('key')
      if (error) fail(error)
      return data
    }
    case 'upsert_memory': {
      const row = { key: a.key, value: a.value, kind: a.kind, updated_at: new Date().toISOString() }
      const { data, error } = await db.from('memory').upsert(row, { onConflict: 'key' }).select().single()
      if (error) fail(error)
      return data
    }
    case 'read_state': {
      const { data, error } = await db.from('daily_state').select('*').eq('date', a.date as string).maybeSingle()
      if (error) fail(error)
      return data
    }
    case 'upsert_state': {
      const row: Record<string, unknown> = { updated_at: new Date().toISOString() }
      for (const k of ['date', 'phase', 'cadence_day', 'cadence_theme', 'helix_topic', 'quiz_round', 'quiz_scores', 'notes']) {
        if (a[k] !== undefined && a[k] !== null) row[k] = a[k]
      }
      const { data, error } = await db.from('daily_state').upsert(row, { onConflict: 'date' }).select().single()
      if (error) fail(error)
      return data
    }
    case 'append_learning': {
      const row = { date: a.date, agent: a.agent, topic: a.topic ?? null, content: a.content ?? null }
      const { data, error } = await db.from('learning').insert(row).select().single()
      if (error) fail(error)
      return data
    }
    case 'read_learning': {
      let q = db.from('learning').select('*').order('created_at', { ascending: false })
        .limit(Number(a.limit ?? 20))
      if (a.agent) q = q.eq('agent', a.agent as string)
      if (a.date) q = q.eq('date', a.date as string)
      const { data, error } = await q
      if (error) fail(error)
      return data
    }
    case 'delegate':
      return await runSubagent(String(a.agent), String(a.request ?? ''))
    case 'think':
      return a.thought ?? ''
    default:
      return { error: `unknown tool ${name}` }
  }
}
