// The Google self-test must name the layer that actually broke, because
// Google's own error text does not distinguish the common setup mistakes.
const FN = new URL('..', import.meta.url).href.replace(/\/$/, '')

let failures = 0
const check = (c: unknown, l: string) => {
  if (c) console.log(`  ok   ${l}`)
  else { failures++; console.log(`  FAIL ${l}`) }
}

let listStatus = 200
let createStatus = 200

globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  const method = (init?.method ?? 'GET').toUpperCase()
  const json = (v: unknown, s = 200) =>
    new Response(JSON.stringify(v), { status: s, headers: { 'Content-Type': 'application/json' } })

  if (url === 'https://oauth2.googleapis.com/token') return json({ access_token: 'tok', expires_in: 3600 })
  if (url.includes('/calendar/v3/') && method === 'POST') {
    if (createStatus !== 200) {
      return new Response(JSON.stringify({ error: { message: 'forbidden for non-organizer' } }), { status: createStatus })
    }
    return json({ id: 'e1', htmlLink: 'https://calendar.google.com/e1' })
  }
  if (url.includes('/calendar/v3/')) {
    if (listStatus !== 200) {
      const msg = listStatus === 404 ? 'Not Found' : 'Google Calendar API has not been used in project 508507 before or it is disabled'
      return new Response(JSON.stringify({ error: { message: msg } }), { status: listStatus })
    }
    return json({ items: [{ summary: 'Lab meeting', start: { dateTime: '2026-09-13T09:00:00+01:00' } }] })
  }
  throw new Error('unexpected ' + url)
}) as typeof fetch

// a real key so signing works
const pair = await crypto.subtle.generateKey(
  { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
  true, ['sign', 'verify'],
)
const pkcs8 = new Uint8Array(await crypto.subtle.exportKey('pkcs8', pair.privateKey))
let bin = ''
for (const x of pkcs8) bin += String.fromCharCode(x)
const KEY = {
  client_email: 'nixon-bot@nixon-508507.iam.gserviceaccount.com',
  private_key: `-----BEGIN PRIVATE KEY-----\n${btoa(bin).match(/.{1,64}/g)!.join('\n')}\n-----END PRIVATE KEY-----\n`,
}

const realServe = Deno.serve
// deno-lint-ignore no-explicit-any
;(Deno as any).serve = () => ({ finished: Promise.resolve() })
const pulse = await import(`${FN}/pulse/index.ts`)
const { resetGoogleToken } = await import(`${FN}/_shared/google.ts`)
// deno-lint-ignore no-explicit-any
;(Deno as any).serve = realServe
const { lisbonNow } = await import(`${FN}/_shared/time.ts`)
const now = lisbonNow()

const run = async () => { resetGoogleToken(); return await pulse.googleSelfTest(now) }

console.log('\n1. secret missing entirely')
Deno.env.delete('GOOGLE_SA_JSON')
let r = await run()
check(r.includes('1. FAIL') && r.includes('is not set'), 'names the missing secret and stops there')
check(!r.includes('2.'), 'does not pretend to check later steps')

console.log('\n2. secret set but corrupt')
Deno.env.set('GOOGLE_SA_JSON', 'oops-not-a-key')
r = await run()
check(r.includes('2. FAIL'), 'fails at the key, not at the calendar')

console.log('\n3. everything healthy')
Deno.env.set('GOOGLE_SA_JSON', btoa(JSON.stringify(KEY)))
Deno.env.set('GOOGLE_CALENDAR_ID', 'nicole@gmail.com')
listStatus = 200; createStatus = 200
r = await run()
check(r.includes('nixon-bot@nixon-508507'), 'reports the robot address she must share with')
check(r.includes('nicole@gmail.com'), 'reports which calendar it is using')
check(r.includes('4. reading the calendar works (1 events today)'), 'read check passes')
check(r.includes('5. writing to the calendar works'), 'write check passes')
check(r.includes('calendar.google.com/e1'), 'gives a link to the test event')

console.log('\n4. calendar not shared with the robot (403 on read)')
listStatus = 403
r = await run()
check(r.includes('4. FAIL'), 'fails at the read step')
check(r.includes('share the calendar with nixon-bot@nixon-508507.iam.gserviceaccount.com'), 'tells her exactly who to share with')
check(r.includes('enable the Google Calendar API'), 'names the other likely cause')
check(!r.includes('5.'), 'stops rather than cascading a second confusing error')

console.log('\n5. API not enabled (404 on read)')
listStatus = 404
r = await run()
check(r.includes('4. FAIL') && r.includes('share the calendar'), 'same actionable advice on 404')

console.log('\n6. shared read-only (read works, write forbidden)')
listStatus = 200; createStatus = 403
r = await run()
check(r.includes('4. reading the calendar works'), 'read still reported as fine')
check(r.includes('5. FAIL'), 'write reported as the failure')
check(r.includes('Make changes to events'), 'names the exact permission level to pick')

console.log('\n7. calendar id not set')
Deno.env.delete('GOOGLE_CALENDAR_ID')
listStatus = 200; createStatus = 200
r = await run()
check(r.includes('not set'), 'warns the id is missing')
check(r.includes('its own empty calendar'), 'explains why that silently looks like nothing happened')

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURES`)
if (failures) Deno.exit(1)
