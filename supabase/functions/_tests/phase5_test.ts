// Phase 5: service-account JWT (signature verified against a real RSA key),
// token caching, and every Calendar / Sheets / Docs request shape.
const FN = new URL('..', import.meta.url).href.replace(/\/$/, '') // supabase/functions

let failures = 0
const check = (c: unknown, l: string) => {
  if (c) console.log(`  ok   ${l}`)
  else { failures++; console.log(`  FAIL ${l}`) }
}

// ---- a genuine RSA keypair, so signing is really exercised -----------------
const pair = await crypto.subtle.generateKey(
  { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
  true,
  ['sign', 'verify'],
)
const pkcs8 = new Uint8Array(await crypto.subtle.exportKey('pkcs8', pair.privateKey))
let b = ''
for (const x of pkcs8) b += String.fromCharCode(x)
const pem = `-----BEGIN PRIVATE KEY-----\n${btoa(b).match(/.{1,64}/g)!.join('\n')}\n-----END PRIVATE KEY-----\n`

const SA = { client_email: 'nixon@nixon-proj.iam.gserviceaccount.com', private_key: pem.replace(/\n/g, '\\n') }
Deno.env.set('GOOGLE_SA_JSON', btoa(JSON.stringify(SA)))
Deno.env.set('GOOGLE_CALENDAR_ID', 'nicole@gmail.com')

// ---- network stub ----------------------------------------------------------
type Call = { url: string; method: string; body: unknown; auth: string | null }
const calls: Call[] = []
let tokenIssues = 0
let assertion = ''

globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  const method = (init?.method ?? 'GET').toUpperCase()
  const raw = init?.body ? String(init.body) : ''
  const headers = new Headers(init?.headers ?? {})
  const json = (v: unknown, s = 200) =>
    new Response(JSON.stringify(v), { status: s, headers: { 'Content-Type': 'application/json' } })

  if (url === 'https://oauth2.googleapis.com/token') {
    tokenIssues++
    assertion = new URLSearchParams(raw).get('assertion') ?? ''
    return json({ access_token: 'ya29.fake', expires_in: 3600, token_type: 'Bearer' })
  }

  calls.push({ url, method, body: raw ? JSON.parse(raw) : null, auth: headers.get('Authorization') })

  if (url.includes('/calendar/v3/') && method === 'POST') {
    return json({ id: 'evt1', htmlLink: 'https://calendar.google.com/evt1', summary: 'Dentist', start: { dateTime: '2026-09-15T15:00:00+01:00' } })
  }
  if (url.includes('/calendar/v3/')) {
    return json({ items: [{ summary: 'Lab meeting', start: { dateTime: '2026-09-13T09:00:00+01:00' }, end: { dateTime: '2026-09-13T10:00:00+01:00' } }] })
  }
  if (url.includes(':append')) return json({ updates: { updatedRange: 'Competitions!A7:E7' } })
  if (url.includes('sheets.googleapis.com')) return json({ values: [['Name', 'Deadline'], ['Bridport Prize', '2026-05-31']] })
  if (url.includes('docs.googleapis.com')) return json({ replies: [{}] })
  if (url.includes('api.telegram.org')) return json({ ok: true })
  throw new Error('unexpected ' + url)
}) as typeof fetch

const g = await import(`${FN}/_shared/google.ts`)

// ============================================================== 1. the JWT
console.log('\n1. signed assertion')
await g.executeGoogleTool('calendar_list', { time_min_iso: '2026-09-13T00:00:00Z', time_max_iso: '2026-09-14T00:00:00Z' })
const [h64, p64, s64] = assertion.split('.')
const unb64 = (s: string) => JSON.parse(atob(s.replace(/-/g, '+').replace(/_/g, '/')))
const header = unb64(h64), claims = unb64(p64)
check(header.alg === 'RS256' && header.typ === 'JWT', 'RS256 JWT header')
check(claims.iss === SA.client_email, 'issuer is the service account')
check(claims.aud === 'https://oauth2.googleapis.com/token', 'audience is the token endpoint')
check(claims.exp - claims.iat === 3600, 'one-hour assertion')
for (const scope of ['calendar', 'spreadsheets', 'documents']) {
  check(claims.scope.includes(scope), `scope includes ${scope}`)
}
const sigBytes = Uint8Array.from(atob(s64.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))
const verified = await crypto.subtle.verify(
  'RSASSA-PKCS1-v1_5', pair.publicKey, sigBytes, new TextEncoder().encode(`${h64}.${p64}`),
)
check(verified, 'signature verifies against the real public key')
check(assertion.split('.').length === 3 && !/[+/=]/.test(assertion), 'base64url, not base64')

// ========================================================== 2. token caching
console.log('\n2. token is minted once, not per call')
await g.executeGoogleTool('sheet_read', { spreadsheet_id: 'sheet1', tab: 'Sales' })
await g.executeGoogleTool('sheet_read', { spreadsheet_id: 'sheet1', tab: 'Sales' })
check(tokenIssues === 1, `1 token for 3 API calls — got ${tokenIssues}`)
check(calls.every((c) => c.auth === 'Bearer ya29.fake'), 'every request carries the bearer token')

// ============================================================= 3. calendar
console.log('\n3. calendar_create')
calls.length = 0
const ev = await g.executeGoogleTool('calendar_create', {
  title: 'Dentist', start_iso: '2026-09-15T15:00:00', end_iso: '2026-09-15T16:00:00',
}) as Record<string, unknown>
const c = calls[0]
check(c.url.includes('/calendars/nicole%40gmail.com/events'), 'posts to the configured calendar, id encoded')
check((c.body as Record<string, Record<string, string>>).start.timeZone === 'Europe/Lisbon', 'Lisbon timezone sent')
check((c.body as Record<string, string>).summary === 'Dentist', 'title becomes summary')
check(ev.htmlLink === 'https://calendar.google.com/evt1', 'link returned so Nixon can confirm')

console.log('\n4. calendar_list')
calls.length = 0
const list = await g.executeGoogleTool('calendar_list', { time_min_iso: '2026-09-13T00:00:00+01:00', time_max_iso: '2026-09-14T00:00:00+01:00' }) as Record<string, string>[]
check(calls[0].url.includes('singleEvents=true') && calls[0].url.includes('orderBy=startTime'), 'expanded and ordered')
check(list.length === 1 && list[0].title === 'Lab meeting', 'events flattened to title/start/end')

// =============================================================== 5. sheets
console.log('\n5. sheets')
calls.length = 0
await g.executeGoogleTool('sheet_append_row', {
  spreadsheet_id: 'https://docs.google.com/spreadsheets/d/1AbC-dEf_123/edit#gid=0',
  tab: 'Competitions',
  cells: ['Bridport Prize', '£5000', '£12', '2026-05-31'],
})
check(calls[0].url.includes('/spreadsheets/1AbC-dEf_123/'), 'sheet id extracted from a pasted URL')
check(calls[0].url.includes('valueInputOption=USER_ENTERED'), 'USER_ENTERED so dates parse')
check(calls[0].url.includes('insertDataOption=INSERT_ROWS'), 'inserts a row rather than overwriting')
check(JSON.stringify((calls[0].body as Record<string, unknown>).values) === JSON.stringify([['Bridport Prize', '£5000', '£12', '2026-05-31']]), 'cells sent as one row')

const rows = await g.executeGoogleTool('sheet_read', { spreadsheet_id: 'sheet1', tab: 'Competitions' }) as string[][]
check(Array.isArray(rows) && rows[1][0] === 'Bridport Prize', 'sheet_read returns rows')

// ================================================================= 6. docs
console.log('\n6. docs')
calls.length = 0
await g.executeGoogleTool('doc_append', {
  document_id: 'https://docs.google.com/document/d/DOC123/edit', text: '\n2026-09-12 | WP2 | plate read',
})
check(calls[0].url.includes('/documents/DOC123:batchUpdate'), 'doc id extracted from URL')
const req = (calls[0].body as { requests: Record<string, Record<string, unknown>>[] }).requests[0]
check(req.insertText?.endOfSegmentLocation !== undefined, 'appends at end of body without reading the doc first')
check(String(req.insertText?.text).includes('WP2'), 'text sent')

// ====================================================== 7. wiring + safety
console.log('\n7. wiring')
const { NIXON_TOOLS } = await import(`${FN}/_shared/tools.ts`)
const { SUBAGENTS } = await import(`${FN}/_shared/subagents.ts`)
const nixonNames = NIXON_TOOLS.map((t: { name: string }) => t.name)
for (const t of ['calendar_create', 'calendar_list', 'sheet_append_row', 'sheet_read', 'doc_append', 'telegram_send']) {
  check(nixonNames.includes(t), `Nixon has ${t}`)
}
check(nixonNames.includes('upsert_task') && nixonNames.includes('delegate'), 'database tools still present')
for (const a of ['helix', 'cadence', 'compass', 'ember', 'ledger', 'forge']) {
  const names = SUBAGENTS[a].tools.map((t: { name: string }) => t.name)
  check(names.includes('sheet_read'), `${a} can read sheets`)
  check(!names.some((n: string) => ['sheet_append_row', 'calendar_create', 'doc_append', 'telegram_send'].includes(n)), `${a} cannot write`)
}
const denied = await SUBAGENTS.ember.execute('sheet_append_row', { spreadsheet_id: 'x', tab: 'y', cells: ['z'] })
check(JSON.stringify(denied).includes('no tool'), 'a subagent asking to write is refused')

// ============================================== 8. misconfiguration messages
console.log('\n8. clear errors when set up wrong')
g.resetGoogleToken()
Deno.env.set('GOOGLE_SA_JSON', 'not-base64-not-json{')
let msg = ''
try { await g.executeGoogleTool('sheet_read', { spreadsheet_id: 'x', tab: 'y' }) } catch (e) { msg = String(e) }
check(/GOOGLE_SA_JSON/.test(msg), `names the bad secret — ${msg.slice(0, 70)}`)
Deno.env.delete('GOOGLE_SA_JSON')
g.resetGoogleToken()
msg = ''
try { await g.executeGoogleTool('sheet_read', { spreadsheet_id: 'x', tab: 'y' }) } catch (e) { msg = String(e) }
check(msg.includes('supabase secrets set'), 'tells her the exact command to run')

console.log('\n9. raw JSON secret also accepted')
Deno.env.set('GOOGLE_SA_JSON', JSON.stringify(SA))
g.resetGoogleToken()
const okRaw = await g.executeGoogleTool('sheet_read', { spreadsheet_id: 'x', tab: 'y' })
check(Array.isArray(okRaw), 'un-encoded JSON works too, since it is easy to paste')

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURES`)
if (failures) Deno.exit(1)
