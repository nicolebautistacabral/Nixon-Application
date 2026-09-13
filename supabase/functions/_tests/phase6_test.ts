// Phase 6: pulse scheduling. The clock is driven through real Lisbon
// instants, including both sides of a daylight-saving change.
const FN = new URL('..', import.meta.url).href.replace(/\/$/, '')

let failures = 0
const check = (c: unknown, l: string) => {
  if (c) console.log(`  ok   ${l}`)
  else { failures++; console.log(`  FAIL ${l}`) }
}

const tables: Record<string, Record<string, unknown>[]> = {
  settings: [{ key: 'owner_chat_id', value: '111' }],
  memory: [], daily_state: [], tasks: [], learning: [], messages: [],
}
const sent: string[] = []
let modelCalls = 0
let lastPrompt = ''

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
    lastPrompt = JSON.parse(raw).contents?.at(-1)?.parts?.[0]?.text ?? ''
    return json({ candidates: [{ content: { role: 'model', parts: [{ text: '🇵🇹 Bom dia, Nicole.' }] } }] })
  }
  if (url.includes('/rest/v1/')) {
    const u = new URL(url)
    const table = u.pathname.split('/rest/v1/')[1].split('?')[0]
    const rows = tables[table] ?? (tables[table] = [])
    const wantsObj = (headers.get('Accept') ?? '').includes('pgrst.object')
    if (method === 'POST') {
      const p = JSON.parse(raw)
      const key = { settings: 'key', memory: 'key', tasks: 'task_id', daily_state: 'date' }[table]
      const hit = key ? rows.find((r) => r[key] === p[key]) : undefined
      if (hit) Object.assign(hit, p); else rows.push(p)
      return json(wantsObj ? (hit ?? p) : [hit ?? p], 201)
    }
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
const pulse = await import(`${FN}/pulse/index.ts`)
// deno-lint-ignore no-explicit-any
;(Deno as any).serve = realServe
const { lisbonNow } = await import(`${FN}/_shared/time.ts`)

// ======================================================== 1. the timetable
console.log('\n1. which pulse is due when (Lisbon)')
// Lisbon is UTC+1 in summer, UTC+0 in winter. Times below are given in UTC.
const cases: [string, string | null, string][] = [
  ['2026-09-13T06:00:00Z', 'pulse_0700_cadence', '07:00 summer'],
  ['2026-09-13T06:07:00Z', 'pulse_0700_cadence', '07:07, cron ran late'],
  ['2026-09-13T06:12:00Z', null, '07:12 is outside the window'],
  ['2026-09-13T11:00:00Z', 'pulse_1200_midday', '12:00'],
  ['2026-09-13T17:00:00Z', 'pulse_1800_evening', '18:00'],
  ['2026-09-13T21:00:00Z', 'pulse_2200_close', '22:00'],
  ['2026-09-13T21:15:00Z', 'pulse_2215_recap', '22:15'],
  ['2026-09-13T21:24:00Z', 'pulse_2215_recap', '22:24 still counts'],
  ['2026-09-13T21:30:00Z', null, '22:30 is nothing'],
  ['2026-09-13T08:00:00Z', null, '09:00 is nothing'],
  // After the October clock change Lisbon is UTC+0, same wall-clock pulses.
  ['2026-11-10T07:00:00Z', 'pulse_0700_cadence', '07:00 winter, same UTC hour would be 08:00 summer'],
  ['2026-11-10T06:00:00Z', null, '06:00 winter is nothing'],
]
for (const [iso, want, label] of cases) {
  const got = pulse.modeFor(lisbonNow(new Date(iso)))
  check(got === want, `${label} → ${got ?? 'no-op'}`)
}

// ============================================================= 2. the secret
console.log('\n2. the endpoint is closed without the secret')
const call = (secret: string | null, qs = '') => {
  const h: Record<string, string> = {}
  if (secret !== null) h['x-nixon-secret'] = secret
  return handler(new Request(`http://x/pulse${qs}`, { headers: h }))
}
check((await call(null)).status === 403, 'no header → 403')
check((await call('wrong')).status === 403, 'wrong secret → 403')

console.log('\n3. an unknown forced mode is rejected, not guessed')
const bad = await call('cron', '?force=pulse_0300_nonsense')
check(bad.status === 400, 'unknown mode → 400')
check((await bad.text()).includes('pulse_0700_cadence'), 'lists the valid modes')

// ============================================================== 4. a real run
console.log('\n4. forced morning pulse')
modelCalls = 0
const res = await call('cron', '?force=pulse_0700_cadence')
check(res.status === 200, '200')
check((await res.text()).includes('sent'), 'reports it sent')
check(sent.length === 1 && sent[0].includes('Bom dia'), "Nicole receives Nixon's reply")
check(modelCalls === 1, `one model request — got ${modelCalls}`)
check(lastPrompt.includes('SCHEDULED PULSE pulse_0700_cadence'), 'header names the pulse')
check(lastPrompt.includes('MEMORY:'), 'memory prefetched into the pulse too')
check(tables.messages.length === 2, 'both turns recorded')
check(tables.messages[0].content === '[pulse_0700_cadence]', 'the user turn is the pulse label, not a fake message')

// =========================================================== 5. no double send
console.log('\n5. a repeated cron call does not send twice')
const now = lisbonNow()
const before = sent.length
const again = await pulse.runPulse('pulse_0700_cadence', now, false)
check(again.includes('already sent'), `second call skipped — "${again}"`)
check(sent.length === before, 'nothing sent the second time')
const forced = await pulse.runPulse('pulse_0700_cadence', now, true)
check(forced.includes('sent') && !forced.includes('already'), 'force overrides the guard, for testing')

console.log('\n6. a different pulse the same day still runs')
check((await pulse.runPulse('pulse_1200_midday', now, false)).includes('sent'), 'midday independent of morning')

// ============================================================ 7. off-schedule
console.log('\n7. an ordinary hourly call at a quiet hour is a cheap no-op')
modelCalls = 0
const quiet = await call('cron')
const body = await quiet.text()
check(quiet.status === 200, '200 so pg_cron stays happy')
if (pulse.modeFor(lisbonNow()) === null) {
  check(body.startsWith('no-op'), `says no-op — "${body.slice(0, 30)}"`)
  check(modelCalls === 0, 'costs no model request')
} else {
  console.log(`  skip  it is genuinely pulse time right now (${body})`)
}

// ============================================================= 8. failure path
console.log('\n8. a failure is logged, not retried forever')
const prev = globalThis.fetch
globalThis.fetch = (async (i: string | URL | Request, init?: RequestInit) => {
  const url = typeof i === 'string' ? i : i instanceof URL ? i.href : i.url
  if (url.includes('generativelanguage')) throw new Error('network down')
  return prev(i, init)
}) as typeof fetch
const failed = await call('cron', '?force=pulse_1800_evening')
globalThis.fetch = prev
check(failed.status === 200, '200 even on failure, so cron does not pile up retries')
check((await failed.text()).includes('failed'), 'body says it failed')

console.log('\n9. no owner yet')
tables.settings[0].value = ''
check((await pulse.runPulse('pulse_1200_midday', lisbonNow(), true)).includes('no owner'), 'says so instead of crashing')

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURES`)
if (failures) Deno.exit(1)
