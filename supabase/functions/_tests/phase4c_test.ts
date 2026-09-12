// Daily-quota survival + request-cost accounting, using Nicole's real 429 body.
const FN = new URL('..', import.meta.url).href.replace(/\/$/, '') // supabase/functions

let failures = 0
const check = (c: unknown, l: string) => {
  if (c) console.log(`  ok   ${l}`)
  else { failures++; console.log(`  FAIL ${l}`) }
}

// Verbatim shape of the error Google returned to Nicole.
const DAILY_429 = JSON.stringify({
  error: {
    code: 429,
    message: 'You exceeded your current quota. * Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 20, model: gemini-3.6-flash\nPlease retry in 45.451265915s.',
    status: 'RESOURCE_EXHAUSTED',
    details: [{
      '@type': 'type.googleapis.com/google.rpc.QuotaFailure',
      violations: [{ quotaId: 'GenerateRequestsPerDayPerProjectPerModel-FreeTier', quotaValue: '20' }],
    }, { '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '45s' }],
  },
})
const MINUTE_429 = JSON.stringify({
  error: {
    code: 429, status: 'RESOURCE_EXHAUSTED',
    message: 'Quota exceeded\nPlease retry in 2s.',
    details: [{ '@type': 'type.googleapis.com/google.rpc.QuotaFailure', violations: [{ quotaId: 'GenerateRequestsPerMinutePerProjectPerModel-FreeTier' }] }],
  },
})

const tables: Record<string, Record<string, unknown>[]> = {
  settings: [{ key: 'owner_chat_id', value: '111' }],
  memory: [
    { key: 'rule.confirm_before_sending', value: 'Always confirm first', kind: 'instruction' },
    { key: 'helix.lab_logbook_sheet_id', value: 'abc123', kind: 'id' },
  ],
  daily_state: [], tasks: [], learning: [], messages: [],
}

// model name -> behaviour
let modelBehaviour: Record<string, 'ok' | 'daily' | 'minute' | '404'> = {}
const modelHits: string[] = []
let promptSeen = ''
const sent: string[] = []

globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  const method = (init?.method ?? 'GET').toUpperCase()
  const headers = new Headers(init?.headers ?? {})
  const raw = init?.body ? String(init.body) : ''
  const json = (v: unknown, s = 200) =>
    new Response(JSON.stringify(v), { status: s, headers: { 'Content-Type': 'application/json' } })

  if (url.includes('api.telegram.org')) { sent.push(JSON.parse(raw).text); return json({ ok: true }) }

  if (url.includes('generativelanguage')) {
    const model = url.split('/models/')[1]?.split(':')[0] ?? '?'
    modelHits.push(model)
    const body = JSON.parse(raw)
    promptSeen = (body.systemInstruction?.parts?.[0]?.text ?? '') + '\n' + (body.contents?.at(-1)?.parts?.[0]?.text ?? '')
    switch (modelBehaviour[model] ?? 'ok') {
      case '404': return new Response(JSON.stringify({ error: { code: 404, status: 'NOT_FOUND', message: 'not found' } }), { status: 404 })
      case 'daily': return new Response(DAILY_429, { status: 429 })
      case 'minute': return new Response(MINUTE_429, { status: 429 })
      default: return json({ candidates: [{ content: { role: 'model', parts: [{ text: 'done' }] } }] })
    }
  }

  if (url.includes('/rest/v1/')) {
    const u = new URL(url)
    const table = u.pathname.split('/rest/v1/')[1].split('?')[0]
    const rows = tables[table] ?? (tables[table] = [])
    const wantsObj = (headers.get('Accept') ?? '').includes('pgrst.object')
    if (method === 'POST') { const p = JSON.parse(raw); rows.push(p); return json(wantsObj ? p : [p], 201) }
    let out = [...rows]
    for (const [k, v] of u.searchParams) {
      if (['select', 'order', 'limit', 'offset'].includes(k)) continue
      if (v.startsWith('eq.')) out = out.filter((r) => String(r[k]) === v.slice(3))
    }
    return json(wantsObj ? out[0] ?? null : out)
  }
  throw new Error('unexpected ' + url)
}) as typeof fetch

const realServe = Deno.serve
let handler!: (r: Request) => Response | Promise<Response>
// deno-lint-ignore no-explicit-any
;(Deno as any).serve = (h: typeof handler) => { handler = h; return { finished: Promise.resolve() } }
await import(`${FN}/telegram/index.ts`)
// deno-lint-ignore no-explicit-any
;(Deno as any).serve = realServe

const post = (text: string) =>
  handler(new Request('http://x/', {
    method: 'POST',
    headers: { 'X-Telegram-Bot-Api-Secret-Token': 'sec', 'Content-Type': 'application/json' },
    body: JSON.stringify({ update_id: 1, message: { chat: { id: 111 }, text } }),
  }))

// =================================================== 1. request cost per message
console.log('\n1. one plain message costs one Gemini request')
modelHits.length = 0
await post('hello')
check(modelHits.length === 1, `1 request, was 3 before prefetch — got ${modelHits.length}`)
check(sent.at(-1) === 'done', 'reply delivered')

console.log('\n2. memory and state are handed to the model, not fetched by it')
check(promptSeen.includes('rule.confirm_before_sending [instruction] = Always confirm first'), 'memory row in header')
check(promptSeen.includes('helix.lab_logbook_sheet_id [id] = abc123'), 'id row in header')
check(/TODAY'S STATE \(\d{4}-\d{2}-\d{2}\)/.test(promptSeen), 'state block in header')
check(promptSeen.includes('no row for'), 'empty state stated plainly')
check(promptSeen.includes('Do NOT call read_memory or read_state again'), 'prompt tells it not to re-read')

console.log('\n3. coordinator uses a lite model, not the scarce one')
check(modelHits[0].includes('lite'), `coordinator model = ${modelHits[0]}`)

// ================================================ 4. daily quota → next model
console.log('\n4. spent daily quota falls through to the next model')
modelBehaviour = { 'gemini-flash-lite-latest': 'daily' }
modelHits.length = 0
const t0 = Date.now()
await post('hello again')
check(sent.at(-1) === 'done', 'Nicole still gets an answer')
check(modelHits.length === 2, `tried 2 models — ${modelHits.join(' → ')}`)
check(Date.now() - t0 < 2000, 'no pointless 45s wait on a daily cap')

console.log('\n5. the exhausted model is then skipped entirely')
modelHits.length = 0
await post('third')
check(!modelHits.includes('gemini-flash-lite-latest'), `exhausted model skipped — tried ${modelHits.join(', ')}`)

// ============================================== 6. minute quota still waits
console.log('\n6. a per-minute 429 is waited out, not skipped')
modelBehaviour = {}
const { runAgent } = await import(`${FN}/_shared/gemini.ts`)
let n = 0
const prev = globalThis.fetch
globalThis.fetch = (async (i: string | URL | Request, init?: RequestInit) => {
  const url = typeof i === 'string' ? i : i instanceof URL ? i.href : i.url
  if (url.includes('generativelanguage') && n++ === 0) return new Response(MINUTE_429, { status: 429 })
  return prev(i, init)
}) as typeof fetch
const t1 = Date.now()
const out = await runAgent({ system: 's', history: [], userText: 'u', tools: [], execute: async () => ({}), role: 'author' })
const waited = Date.now() - t1
globalThis.fetch = prev
check(out === 'done', 'recovered after the minute cap')
check(waited >= 1800 && waited < 4000, `honoured Google's "retry in 2s" — waited ${waited}ms`)

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURES`)
if (failures) Deno.exit(1)
