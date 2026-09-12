// Resilience: rate-limit retry, empty-candidate diagnosis, search timeout.
const FN = new URL('..', import.meta.url).href.replace(/\/$/, '') // supabase/functions

let failures = 0
const check = (c: unknown, l: string) => {
  if (c) console.log(`  ok   ${l}`)
  else { failures++; console.log(`  FAIL ${l}`) }
}

type Reply = { status: number; body: string }
let queue: Reply[] = []
let attempts = 0
let epmcDelayMs = 0

globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  if (url.includes('ebi.ac.uk')) {
    // Honour the abort signal the way a real fetch does, so the test measures
    // the code's timeout rather than the stub's indifference.
    await new Promise((resolve, reject) => {
      const t = setTimeout(resolve, epmcDelayMs)
      init?.signal?.addEventListener('abort', () => {
        clearTimeout(t)
        reject(init.signal!.reason ?? new DOMException('aborted', 'AbortError'))
      })
    })
    return new Response(JSON.stringify({ resultList: { result: [] } }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    })
  }
  if (url.includes('generativelanguage')) {
    attempts++
    const r = queue.shift() ?? { status: 200, body: '{"candidates":[{"content":{"role":"model","parts":[{"text":"fallthrough"}]}}]}' }
    return new Response(r.body, { status: r.status, headers: { 'Content-Type': 'application/json' } })
  }
  throw new Error('unexpected ' + url)
}) as typeof fetch

const { runAgent } = await import(`${FN}/_shared/gemini.ts`)
const { natureSearch } = await import(`${FN}/_shared/nature.ts`)

const ok = (text: string) =>
  ({ status: 200, body: JSON.stringify({ candidates: [{ content: { role: 'model', parts: [{ text }] } }] }) })
const err = (status: number, msg: string) =>
  ({ status, body: JSON.stringify({ error: { code: status, message: msg, status: msg } }) })

const run = () => runAgent({ system: 's', history: [], userText: 'u', tools: [], execute: async () => ({}) })

// ============================================================ 1. 429 retry
console.log('\n1. rate limit (429) is retried, not surfaced')
queue = [err(429, 'RESOURCE_EXHAUSTED'), ok('recovered')]
attempts = 0
const t0 = Date.now()
check(await run() === 'recovered', 'answer returned after one 429')
check(attempts === 2, `two attempts made — got ${attempts}`)
check(Date.now() - t0 >= 3000, 'backed off ~3s before retrying')

console.log('\n2. 503 overload is retried twice then gives up')
queue = [err(503, 'UNAVAILABLE'), err(503, 'UNAVAILABLE'), err(503, 'UNAVAILABLE')]
attempts = 0
let caught = ''
try { await run() } catch (e) { caught = e instanceof Error ? e.message : String(e) }
check(attempts === 3, `three attempts (1 + 2 retries) — got ${attempts}`)
check(/503|UNAVAILABLE/i.test(caught), `final error propagates — ${caught.slice(0, 60)}`)

console.log('\n3. a real 400 is NOT retried')
queue = [err(400, 'INVALID_ARGUMENT')]
attempts = 0
caught = ''
try { await run() } catch (e) { caught = e instanceof Error ? e.message : String(e) }
check(attempts === 1, `one attempt only — got ${attempts}`)

// ================================================== 4. empty candidate detail
console.log('\n4. empty response names finishReason')
queue = [{ status: 200, body: JSON.stringify({ candidates: [{ content: { role: 'model', parts: [] }, finishReason: 'MAX_TOKENS' }] }) }]
caught = ''
try { await run() } catch (e) { caught = e instanceof Error ? e.message : String(e) }
check(caught.includes('MAX_TOKENS'), `log names the cause — "${caught}"`)

// ================================================= 5. maxOutputTokens is sent
console.log('\n5. output cap is sent')
let sentConfig: Record<string, unknown> = {}
const prev = globalThis.fetch
globalThis.fetch = (async (i: string | URL | Request, init?: RequestInit) => {
  const url = typeof i === 'string' ? i : i instanceof URL ? i.href : i.url
  if (url.includes('generativelanguage')) sentConfig = JSON.parse(String(init?.body ?? '{}')).generationConfig ?? {}
  return prev(i, init)
}) as typeof fetch
queue = [ok('x')]
await run()
globalThis.fetch = prev
check(sentConfig.maxOutputTokens === 8192, `maxOutputTokens=8192 — got ${sentConfig.maxOutputTokens}`)

// ====================================================== 6. search timeout
console.log('\n6. a hanging Europe PMC search aborts instead of hanging')
epmcDelayMs = 13_000
const t1 = Date.now()
const res = await natureSearch('slow')
const elapsed = Date.now() - t1
check(!Array.isArray(res) && 'error' in res, `aborted with an error object — ${JSON.stringify(res)}`)
check(elapsed < 12_900, `gave up at ~12s, not later — ${elapsed}ms`)

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURES`)
if (failures) Deno.exit(1)
