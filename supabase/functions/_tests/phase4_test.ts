// Phase 4: subagent delegation + Europe PMC parsing, with the network stubbed.
const FN = new URL('..', import.meta.url).href.replace(/\/$/, '') // supabase/functions

let failures = 0
const check = (cond: unknown, label: string) => {
  if (cond) console.log(`  ok   ${label}`)
  else { failures++; console.log(`  FAIL ${label}`) }
}

// Real Europe PMC lite-result shape (trimmed to the fields we read).
const EPMC_OK = {
  version: '6.9',
  hitCount: 2,
  resultList: {
    result: [
      {
        id: '30760894', source: 'MED', pmid: '30760894',
        doi: '10.1038/s41467-019-08034-8',
        title: 'Caffeine intake and adenosine receptor signalling in the human brain.',
        journalTitle: 'Nature Communications', pubYear: '2019',
      },
      {
        id: '25231862', source: 'MED',
        doi: '10.1038/nn.3811',
        title: 'Sleep pressure and adenosine accumulation',
        journalTitle: 'Nature Neuroscience', pubYear: '2014',
      },
      { id: 'x', title: 'No DOI here', journalTitle: 'Nature', pubYear: '2020' }, // must be dropped
    ],
  },
}

let epmcMode: 'ok' | 'down' | 'garbage' = 'ok'
let epmcUrl = ''
const geminiCalls: { model: string; system: string; tools: string[]; text: string }[] = []
let script: { calls?: { name: string; args: Record<string, unknown> }[]; text?: string }[] = []
let turn = 0

globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  const json = (v: unknown, s = 200) =>
    new Response(JSON.stringify(v), { status: s, headers: { 'Content-Type': 'application/json' } })

  if (url.includes('ebi.ac.uk')) {
    epmcUrl = url
    if (epmcMode === 'down') return new Response('gateway timeout', { status: 504 })
    if (epmcMode === 'garbage') return new Response('<html>maintenance</html>', { status: 200 })
    return json(EPMC_OK)
  }

  if (url.includes('generativelanguage')) {
    const body = JSON.parse(String(init?.body ?? '{}'))
    geminiCalls.push({
      model: url.split('/models/')[1]?.split(':')[0] ?? '?',
      system: body.systemInstruction?.parts?.[0]?.text ?? '',
      tools: (body.tools?.[0]?.functionDeclarations ?? []).map((d: { name: string }) => d.name),
      text: body.contents?.at(-1)?.parts?.[0]?.text ?? '',
    })
    const t = script[turn++]
    if (!t) throw new Error('script exhausted')
    const parts = t.calls
      ? t.calls.map((c) => ({ functionCall: { name: c.name, args: c.args } }))
      : [{ text: t.text ?? '' }]
    return json({ candidates: [{ content: { role: 'model', parts } }] })
  }

  throw new Error('unexpected fetch ' + url)
}) as typeof fetch

const { natureSearch } = await import(`${FN}/_shared/nature.ts`)
const { runSubagent, SUBAGENTS } = await import(`${FN}/_shared/subagents.ts`)
const { executeNixonTool } = await import(`${FN}/_shared/tools.ts`)

// ============================================================ 1. nature_search
console.log('\n1. nature_search parsing')
const papers = await natureSearch('caffeine adenosine')
check(Array.isArray(papers) && papers.length === 2, `2 papers parsed (DOI-less row dropped) — got ${Array.isArray(papers) ? papers.length : papers}`)
check(papers[0]?.doi === '10.1038/s41467-019-08034-8', 'DOI extracted')
check(papers[0]?.journal === 'Nature Communications', 'journal extracted')
check(papers[0]?.year === '2019', 'year extracted')
check(!papers[0]?.title.endsWith('.'), 'trailing full stop trimmed from title')
check(epmcUrl.includes('/europepmc/webservices/rest/search'), 'documented endpoint path used')
check(epmcUrl.includes('resultType=lite') && epmcUrl.includes('pageSize=6'), 'lite + pageSize=6')
check(decodeURIComponent(epmcUrl).includes('JOURNAL:"Nature Reviews Neuroscience"'), 'Nature-family filter applied')
check(decodeURIComponent(epmcUrl).includes('sort=CITED desc'), 'sorted by citations')

console.log('\n2. nature_search failure modes (must not throw)')
epmcMode = 'down'
const down = await natureSearch('x')
check(!Array.isArray(down) && 'error' in down, `HTTP 504 → error object, no throw — ${JSON.stringify(down)}`)
epmcMode = 'garbage'
const garbage = await natureSearch('x')
check(!Array.isArray(garbage) && 'error' in garbage, 'non-JSON body → error object, no throw')
epmcMode = 'ok'

// ============================================================== 3. delegation
console.log('\n3. delegate → helix uses nature_search then answers')
script = [
  { calls: [{ name: 'nature_search', args: { query: 'coffee caffeine brain' } }] },
  { text: '🐇 Coffee — the rabbit hole\nLayer 1 · …\n📚 Sources (Nature family):\nCaffeine intake… — Nature Communications (2019) — 10.1038/s41467-019-08034-8' },
]
turn = 0
geminiCalls.length = 0
const helixOut = await executeNixonTool('delegate', { agent: 'helix', request: '5-layer rabbit hole lesson on coffee' })
check(String(helixOut).includes('🐇'), 'helix answer returned through delegate')
check(geminiCalls.length === 2, `two model turns (tool call, then answer) — got ${geminiCalls.length}`)
check(geminiCalls[0].system.startsWith('You are HELIX'), 'HELIX system prompt used')
check(geminiCalls[0].tools.includes('nature_search'), 'helix given nature_search')
check(geminiCalls[0].text === '5-layer rabbit hole lesson on coffee', 'request passed verbatim, no history')

console.log('\n4. delegate → cadence gets read-only tools')
script = [{ text: '🎭 1. Shakespeare → today…' }]
turn = 0
geminiCalls.length = 0
const cadOut = await executeNixonTool('delegate', { agent: 'cadence', request: 'morning lesson | cadence_day=1 | theme=Groceries' })
check(String(cadOut).includes('🎭'), 'cadence answer returned')
check(geminiCalls[0].system.startsWith('You are CADENCE'), 'CADENCE system prompt used')
check(geminiCalls[0].tools.join() === 'sheet_read', `cadence given sheet_read and nothing else — ${geminiCalls[0].tools.join() || 'none'}`)

console.log('\n5. all six wired, bad name handled')
check(Object.keys(SUBAGENTS).length === 6, `six subagents — got ${Object.keys(SUBAGENTS).length}`)
for (const a of ['helix', 'cadence', 'compass', 'ember', 'ledger', 'forge']) {
  check(SUBAGENTS[a]?.system?.startsWith(`You are ${a.toUpperCase()}`), `${a} prompt present`)
}
check(String(await runSubagent('nixon', 'x')).includes('No subagent'), 'unknown agent → message, not a crash')

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURES`)
if (failures) Deno.exit(1)
