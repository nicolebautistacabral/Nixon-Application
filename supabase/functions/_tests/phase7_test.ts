// Phase 7: duplicate-update protection and nightly housekeeping.
const FN = new URL('..', import.meta.url).href.replace(/\/$/, '')

let failures = 0
const check = (c: unknown, l: string) => {
  if (c) console.log(`  ok   ${l}`)
  else { failures++; console.log(`  FAIL ${l}`) }
}

const tables: Record<string, Record<string, unknown>[]> = {
  settings: [{ key: 'owner_chat_id', value: '111' }],
  memory: [], daily_state: [], tasks: [], learning: [],
  messages: [], processed_updates: [],
}
let nextId = 1
const sent: string[] = []
let modelCalls = 0
let updatesTableBroken = false

globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  const method = (init?.method ?? 'GET').toUpperCase()
  const headers = new Headers(init?.headers ?? {})
  const raw = init?.body ? String(init.body) : ''
  const json = (v: unknown, s = 200) =>
    new Response(JSON.stringify(v), { status: s, headers: { 'Content-Type': 'application/json' } })

  if (url.includes('api.telegram.org')) { sent.push(JSON.parse(raw).text); return json({ ok: true }) }
  if (url.includes('generativelanguage')) {
    modelCalls++
    return json({ candidates: [{ content: { role: 'model', parts: [{ text: 'ok Nicole' }] } }] })
  }

  if (url.includes('/rest/v1/')) {
    const u = new URL(url)
    const table = u.pathname.split('/rest/v1/')[1].split('?')[0]
    const rows = tables[table] ?? (tables[table] = [])
    const wantsObj = (headers.get('Accept') ?? '').includes('pgrst.object')

    if (table === 'processed_updates' && updatesTableBroken) {
      return json({ code: '42P01', message: 'relation "processed_updates" does not exist' }, 404)
    }

    if (method === 'POST') {
      const p = JSON.parse(raw)
      if (table === 'processed_updates') {
        // real Postgres primary-key behaviour
        if (rows.some((r) => r.update_id === p.update_id)) {
          return json({ code: '23505', message: 'duplicate key value violates unique constraint' }, 409)
        }
        rows.push({ ...p, seen_at: p.seen_at ?? new Date().toISOString() })
        return json([p], 201)
      }
      const key = { settings: 'key', memory: 'key', tasks: 'task_id', daily_state: 'date' }[table]
      const hit = key ? rows.find((r) => r[key] === p[key]) : undefined
      if (hit) Object.assign(hit, p)
      else rows.push(table === 'messages' ? { id: nextId++, ...p } : p)
      return json(wantsObj ? (hit ?? p) : [hit ?? p], 201)
    }

    const filter = (list: Record<string, unknown>[]) => {
      let out = [...list]
      for (const [k, v] of u.searchParams) {
        if (['select', 'order', 'limit', 'offset'].includes(k)) continue
        if (v.startsWith('eq.')) out = out.filter((r) => String(r[k]) === v.slice(3))
        else if (v.startsWith('lte.')) out = out.filter((r) => Number(r[k]) <= Number(v.slice(4)))
        else if (v.startsWith('lt.')) out = out.filter((r) => String(r[k]) < v.slice(3))
      }
      return out
    }

    if (method === 'DELETE') {
      const doomed = filter(rows)
      tables[table] = rows.filter((r) => !doomed.includes(r))
      return json(doomed)
    }

    let out = filter(rows)
    const order = u.searchParams.get('order')
    if (order?.startsWith('id.desc')) out.sort((a, b) => Number(b.id) - Number(a.id))
    if (order?.startsWith('created_at.desc')) out.reverse()
    const offset = Number(u.searchParams.get('offset') ?? 0)
    const limit = u.searchParams.get('limit')
    out = out.slice(offset, limit ? offset + Number(limit) : undefined)
    return json(wantsObj ? out[0] ?? null : out)
  }
  throw new Error('unexpected ' + url)
}) as typeof fetch

const realServe = Deno.serve
type Handler = (r: Request) => Response | Promise<Response>
let captured!: Handler
// deno-lint-ignore no-explicit-any
;(Deno as any).serve = (h: Handler) => { captured = h; return { finished: Promise.resolve() } }
// Both functions call Deno.serve, so grab the webhook's handler before the
// pulse module replaces it.
await import(`${FN}/telegram/index.ts`)
const handler = captured
const pulse = await import(`${FN}/pulse/index.ts`)
// deno-lint-ignore no-explicit-any
;(Deno as any).serve = realServe
if (handler === captured) throw new Error('test wiring: handlers not distinguished')
const db = await import(`${FN}/_shared/db.ts`)
const { lisbonNow } = await import(`${FN}/_shared/time.ts`)

const post = (text: string, updateId: number) =>
  handler(new Request('http://x/', {
    method: 'POST',
    headers: { 'X-Telegram-Bot-Api-Secret-Token': 'sec', 'Content-Type': 'application/json' },
    body: JSON.stringify({ update_id: updateId, message: { chat: { id: 111 }, text } }),
  }))

// ==================================================== 1. duplicate delivery
console.log('\n1. Telegram redelivering the same update')
modelCalls = 0
await post('Add: dentist Tuesday 15:00', 900)
const afterFirst = { calls: modelCalls, sent: sent.length, msgs: tables.messages.length }
check(afterFirst.calls === 1, 'first delivery is handled')

await post('Add: dentist Tuesday 15:00', 900) // Telegram retries the same id
check(modelCalls === afterFirst.calls, `no second model request — still ${modelCalls}`)
check(sent.length === afterFirst.sent, 'Nicole is not messaged twice')
check(tables.messages.length === afterFirst.msgs, 'no duplicate rows in messages')

console.log('\n2. a genuinely new message still gets through')
await post('and one on Thursday', 901)
check(modelCalls === 2, `handled — ${modelCalls} model requests total`)
check(tables.processed_updates.length === 2, 'both ids recorded')

console.log('\n3. if the dedupe table is unavailable, messages still work')
updatesTableBroken = true
modelCalls = 0
await post('still listening?', 902)
updatesTableBroken = false
check(modelCalls === 1, 'a broken bookkeeping table never silences the bot')

// ========================================================= 4. trimming
console.log('\n4. trimming messages')
tables.messages = []
nextId = 1
for (let i = 0; i < 250; i++) tables.messages.push({ id: nextId++, chat_id: '111', role: 'user', content: `m${i}` })
tables.messages.push({ id: nextId++, chat_id: '222', role: 'user', content: 'someone else' })

const removed = await db.trimMessages('111', 200)
check(removed === 50, `dropped the oldest 50 — got ${removed}`)
const left = tables.messages.filter((m) => m.chat_id === '111')
check(left.length === 200, `200 kept — got ${left.length}`)
check(left.every((m) => Number(m.id) > 50), 'the ones kept are the newest')
check(tables.messages.some((m) => m.chat_id === '222'), 'another chat is untouched')

console.log('\n5. trimming under the threshold does nothing')
tables.messages = [{ id: 1, chat_id: '111', role: 'user', content: 'x' }]
check(await db.trimMessages('111', 200) === 0, 'no-op when there is little history')
check(tables.messages.length === 1, 'nothing deleted')

console.log('\n6. old dedupe rows are pruned, recent ones kept')
const old = new Date(Date.now() - 30 * 86400000).toISOString()
const recent = new Date(Date.now() - 3600_000).toISOString()
tables.processed_updates = [
  { update_id: 1, seen_at: old }, { update_id: 2, seen_at: old }, { update_id: 3, seen_at: recent },
]
await db.pruneProcessedUpdates(7)
check(tables.processed_updates.length === 1, `2 old rows pruned — ${tables.processed_updates.length} left`)
check(tables.processed_updates[0].update_id === 3, 'the recent one survives')

// ================================================ 7. wired to the 22:00 pulse
console.log('\n7. housekeeping runs at the day close, and only there')
tables.messages = []
nextId = 1
for (let i = 0; i < 260; i++) tables.messages.push({ id: nextId++, chat_id: '111', role: 'user', content: `m${i}` })
tables.processed_updates = [{ update_id: 9, seen_at: old }]
const now = lisbonNow()

await pulse.runPulse('pulse_1200_midday', now, true)
check(tables.messages.filter((m) => m.chat_id === '111').length > 200, 'midday does not trim')

await pulse.runPulse('pulse_2200_close', now, true)
const after = tables.messages.filter((m) => m.chat_id === '111').length
check(after === 200, `close trims to 200 — got ${after}`)
check(tables.processed_updates.length === 0, 'and prunes stale dedupe rows')
check(sent.at(-1)?.includes('ok Nicole'), 'Nicole still got her day-close message')

console.log('\n8. cleanup failure never costs Nicole her message')
tables.messages = []
for (let i = 0; i < 260; i++) tables.messages.push({ id: i + 1, chat_id: '111', role: 'user', content: 'x' })
updatesTableBroken = true
const before = sent.length
const res = await pulse.runPulse('pulse_2200_close', now, true)
updatesTableBroken = false
check(res.includes('sent'), 'pulse still reports success')
check(sent.length === before + 1, 'message delivered despite the cleanup problem')

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURES`)
if (failures) Deno.exit(1)
