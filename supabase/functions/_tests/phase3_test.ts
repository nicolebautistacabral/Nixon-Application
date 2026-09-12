// Phase 3 integration test: stubs Gemini + PostgREST, drives the real webhook.
const FN = new URL('..', import.meta.url).href.replace(/\/$/, '') // supabase/functions

// ---------------------------------------------------------------- fake tables
const tables: Record<string, Record<string, unknown>[]> = {
  settings: [{ key: 'owner_chat_id', value: '111' }],
  memory: [],
  tasks: [],
  daily_state: [],
  learning: [],
  messages: [],
}
const pk: Record<string, string> = { settings: 'key', memory: 'key', tasks: 'task_id', daily_state: 'date' }

// ------------------------------------------------------------- gemini script
// Each entry is one model turn: either function calls or final text.
type Turn = { calls?: { name: string; args: Record<string, unknown> }[]; text?: string }
let script: Turn[] = []
let turnIndex = 0
const toolLog: string[] = []
const sent: { chat: string; text: string }[] = []
let geminiFailures = 0
let retiredHits = 0
const modelsUsed = new Set<string>()

function geminiBody(turn: Turn) {
  const parts = turn.calls
    ? turn.calls.map((c) => ({ functionCall: { name: c.name, args: c.args } }))
    : [{ text: turn.text ?? '' }]
  return JSON.stringify({ candidates: [{ content: { role: 'model', parts }, finishReason: 'STOP' }] })
}

// ----------------------------------------------------------------- fetch stub
globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase()
  const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined))
  const raw = init?.body ? String(init.body) : ''
  const json = (v: unknown, status = 200) =>
    new Response(JSON.stringify(v), { status, headers: { 'Content-Type': 'application/json' } })

  // --- Gemini ---
  if (url.includes('generativelanguage.googleapis.com')) {
    // Mimic Google retiring a model for new keys: the first candidate 404s.
    if (url.includes('gemini-flash-lite-latest')) {
      retiredHits++
      return new Response(
        '{"error":{"code":404,"message":"This model is no longer available to new users.","status":"NOT_FOUND"}}',
        { status: 404 },
      )
    }
    modelsUsed.add(url.split('/models/')[1]?.split(':')[0] ?? '?')
    if (geminiFailures > 0) {
      geminiFailures--
      return new Response('{"error":{"code":503}}', { status: 503 })
    }
    const turn = script[turnIndex++]
    if (!turn) throw new Error('gemini script exhausted')
    // record what the model was fed back
    const body = JSON.parse(raw)
    for (const c of body.contents ?? []) {
      for (const p of c.parts ?? []) {
        if (p.functionResponse) toolLog.push(`resp:${p.functionResponse.name}`)
      }
    }
    return new Response(geminiBody(turn), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }

  // --- Telegram ---
  if (url.includes('api.telegram.org')) {
    const b = JSON.parse(raw)
    sent.push({ chat: String(b.chat_id), text: b.text })
    return json({ ok: true })
  }

  // --- PostgREST ---
  if (url.includes('/rest/v1/')) {
    const u = new URL(url)
    const table = u.pathname.split('/rest/v1/')[1].split('?')[0]
    const rows = tables[table] ?? (tables[table] = [])
    const wantsObject = (headers.get('Accept') ?? '').includes('pgrst.object')

    if (method === 'POST') {
      const payload = JSON.parse(raw)
      const list = Array.isArray(payload) ? payload : [payload]
      const saved: Record<string, unknown>[] = []
      for (const row of list) {
        const key = pk[table]
        const existing = key ? rows.find((r) => r[key] === row[key]) : undefined
        if (existing) {
          Object.assign(existing, row)
          saved.push(existing)
        } else {
          const withId = { id: rows.length + 1, ...row }
          rows.push(withId)
          saved.push(withId)
        }
      }
      return json(wantsObject ? saved[0] : saved, 201)
    }

    // GET with eq.<value> filters
    let out = [...rows]
    for (const [k, v] of u.searchParams) {
      if (['select', 'order', 'limit', 'offset'].includes(k)) continue
      if (v.startsWith('eq.')) out = out.filter((r) => String(r[k]) === v.slice(3))
    }
    const order = u.searchParams.get('order')
    if (order?.startsWith('created_at.desc')) out = [...out].reverse()
    const limit = u.searchParams.get('limit')
    if (limit) out = out.slice(0, Number(limit))
    if (wantsObject) return json(out[0] ?? null)
    return json(out)
  }

  throw new Error('unexpected fetch ' + url)
}) as typeof fetch

// ------------------------------------------------------------ boot the module
const realServe = Deno.serve
let handler!: (r: Request) => Response | Promise<Response>
// deno-lint-ignore no-explicit-any
;(Deno as any).serve = (h: typeof handler) => { handler = h; return { finished: Promise.resolve() } }
await import(`${FN}/telegram/index.ts`)
// deno-lint-ignore no-explicit-any
;(Deno as any).serve = realServe

const post = (text: string, chat = 111, secret = 'sec') =>
  handler(new Request('http://x/', {
    method: 'POST',
    headers: { 'X-Telegram-Bot-Api-Secret-Token': secret, 'Content-Type': 'application/json' },
    body: JSON.stringify({ update_id: 1, message: { chat: { id: chat }, text } }),
  }))

let failures = 0
const check = (cond: unknown, label: string) => {
  if (cond) console.log(`  ok   ${label}`)
  else { failures++; console.log(`  FAIL ${label}`) }
}

// ============================================================== 1. memory rule
console.log('\n1. "Remember: confirm before sending to a student"')
script = [
  { calls: [{ name: 'read_memory', args: {} }, { name: 'read_state', args: { date: '2026-09-12' } }] },
  { calls: [{ name: 'upsert_memory', args: { key: 'rule.confirm_before_sending', value: 'Always confirm with Nicole before sending anything to a student', kind: 'instruction' } }] },
  { text: 'Saved — I will always check with you before anything goes to a student.' },
]
turnIndex = 0
await post('Remember: I always want confirmation before you send anything to a student')
check(tables.memory.length === 1, 'memory row written')
check(tables.memory[0]?.key === 'rule.confirm_before_sending', 'memory key correct')
check(tables.memory[0]?.kind === 'instruction', 'kind=instruction')
check(sent.at(-1)?.text.startsWith('Saved'), 'reply sent to Telegram')
check(tables.messages.length === 2, 'both turns saved to messages')
check(tables.messages[0]?.content === 'Remember: I always want confirmation before you send anything to a student', 'user turn stored raw (no header)')
check(toolLog.includes('resp:read_memory') && toolLog.includes('resp:upsert_memory'), 'tool responses fed back')

// ================================================================ 2. add task
console.log('\n2. "Add: WP2 report by Friday 17:00"')
script = [
  { calls: [{ name: 'read_memory', args: {} }, { name: 'read_state', args: { date: '2026-09-12' } }] },
  { calls: [{ name: 'upsert_task', args: { task_id: 'helix-wp2-report', agent: 'helix', task: 'Submit WP2 report', deadline: '2026-09-18T17:00:00+01:00', status: 'open', priority: 'high' } }] },
  { text: '📌 Saved: Submit WP2 report — Friday 17:00.' },
]
turnIndex = 0
await post('Add: WP2 report by Friday 17:00')
check(tables.tasks.length === 1, 'task row written')
check(tables.tasks[0]?.status === 'open', 'status open')
check(typeof tables.tasks[0]?.updated_at === 'string', 'updated_at stamped')

// =============================================================== 3. mark done
console.log('\n3. "Done with the WP2 report"')
script = [
  { calls: [{ name: 'read_memory', args: {} }, { name: 'read_state', args: { date: '2026-09-12' } }] },
  { calls: [{ name: 'read_tasks', args: { status: 'open' } }] },
  { calls: [{ name: 'upsert_task', args: { task_id: 'helix-wp2-report', agent: 'helix', task: 'Submit WP2 report', status: 'done' } }] },
  { text: '✅ WP2 report ticked off. 0 open tasks left.' },
]
turnIndex = 0
await post('Done with the WP2 report')
check(tables.tasks.length === 1, 'no duplicate task created')
check(tables.tasks[0]?.status === 'done', 'task flipped to done')
check(sent.at(-1)?.text.startsWith('✅'), 'confirmation sent')

// ========================================================= 4. history loading
console.log('\n4. history')
script = [{ text: 'ok' }]
turnIndex = 0
let seenHistory = 0
const realFetch = globalThis.fetch
globalThis.fetch = (async (i: string | URL | Request, init?: RequestInit) => {
  const url = typeof i === 'string' ? i : i instanceof URL ? i.href : i.url
  if (url.includes('generativelanguage') && init?.body) {
    seenHistory = JSON.parse(String(init.body)).contents.length
  }
  return realFetch(i, init)
}) as typeof fetch
await post('what is open?')
globalThis.fetch = realFetch
check(seenHistory === 7, `history replayed (6 past turns + new) — got ${seenHistory}`)

// ============================================================ 5. error path
console.log('\n5. Gemini failure → apology')
geminiFailures = 5 // outlast the retries
script = [{ text: 'never reached' }]
turnIndex = 0
const before = sent.length
await post('hello?')
check(sent.length === before + 1, 'one message sent')
check(sent.at(-1)?.text === 'Something broke on my side — try again in a minute.', 'apology text')

// ============================================================ 6. guards intact
console.log('\n6. guards')
script = [{ text: 'x' }]; turnIndex = 0
check((await post('hi', 111, 'wrong')).status === 403, 'bad secret → 403')
const b2 = sent.length
script = [{ text: 'x' }]; turnIndex = 0
await post('hack', 999)
check(sent.length === b2, 'non-owner ignored')

// ========================================================= 7. model fallback
console.log('\n7. retired-model fallback')
check(retiredHits >= 1, `retired model was probed — got ${retiredHits}`)
check(modelsUsed.size === 1, `settled on exactly one working model — ${[...modelsUsed]}`)
check([...modelsUsed][0].includes('lite'), `coordinator spends the cheap quota — ${[...modelsUsed][0]}`)

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURES`)
if (failures) Deno.exit(1)
