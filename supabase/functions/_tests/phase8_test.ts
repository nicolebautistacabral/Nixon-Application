// Drive folders per agent: discovery from one root link, caching, and the
// read-only boundary that keeps writes with Nixon.
const FN = new URL('..', import.meta.url).href.replace(/\/$/, '')

let failures = 0
const check = (c: unknown, l: string) => {
  if (c) console.log(`  ok   ${l}`)
  else { failures++; console.log(`  FAIL ${l}`) }
}

const ROOT = '1i91hvrH0CTQBZ2fx3bijtbcefDhPgiwX'
const FOLDERS = [
  { id: 'fold-helix', name: 'Helix', mimeType: 'application/vnd.google-apps.folder' },
  { id: 'fold-ember', name: 'Ember', mimeType: 'application/vnd.google-apps.folder' },
  { id: 'fold-cadence', name: 'Cadence', mimeType: 'application/vnd.google-apps.folder' },
  { id: 'fold-compass', name: 'Compass', mimeType: 'application/vnd.google-apps.folder' },
  { id: 'fold-ledger', name: 'Ledger', mimeType: 'application/vnd.google-apps.folder' },
  { id: 'fold-forge', name: 'Forge', mimeType: 'application/vnd.google-apps.folder' },
  { id: 'stray', name: 'notes.txt', mimeType: 'text/plain' },
]
const HELIX_FILES = [
  { id: 'sheet-log', name: 'Lab logbook', mimeType: 'application/vnd.google-apps.spreadsheet', modifiedTime: '2026-09-13T10:00:00Z' },
  { id: 'doc-thesis', name: 'Thesis draft', mimeType: 'application/vnd.google-apps.document', modifiedTime: '2026-09-12T10:00:00Z' },
]

const memory: Record<string, { value: string; kind: string }> = {}
let driveCalls = 0
let lastDriveQ = ''
const geminiPrompts: string[] = []
let script: { calls?: { name: string; args: Record<string, unknown> }[]; text?: string }[] = []
let turn = 0
let lastScopes = ''

globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  const method = (init?.method ?? 'GET').toUpperCase()
  const headers = new Headers(init?.headers ?? {})
  const raw = init?.body ? String(init.body) : ''
  const json = (v: unknown, s = 200) =>
    new Response(JSON.stringify(v), { status: s, headers: { 'Content-Type': 'application/json' } })

  if (url === 'https://oauth2.googleapis.com/token') {
    const jwt = new URLSearchParams(raw).get('assertion') ?? ''
    const claims = JSON.parse(atob(jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    lastScopes = claims.scope
    return json({ access_token: 'tok', expires_in: 3600 })
  }

  if (url.includes('drive/v3/files')) {
    driveCalls++
    const q = new URL(url).searchParams.get('q') ?? ''
    lastDriveQ = q
    if (q.includes(ROOT)) return json({ files: FOLDERS })
    if (q.includes('fold-helix')) return json({ files: HELIX_FILES })
    return json({ files: [] })
  }

  if (url.includes('docs.googleapis.com') && method === 'GET') {
    return json({
      title: 'Thesis draft',
      body: { content: [
        { paragraph: { elements: [{ textRun: { content: 'Chapter one.\n' } }] } },
        { table: { tableRows: [{ tableCells: [{ content: [
          { paragraph: { elements: [{ textRun: { content: 'Plate A1\n' } }] } },
        ] }] }] } },
        { paragraph: { elements: [{ textRun: { content: 'Conclusion.\n' } }] } },
      ] },
    })
  }

  if (url.includes('sheets.googleapis.com')) return json({ values: [['Date', 'WP'], ['2026-09-12', 'WP2']] })

  if (url.includes('generativelanguage')) {
    const body = JSON.parse(raw)
    geminiPrompts.push(body.contents?.at(-1)?.parts?.[0]?.text ?? '')
    const t = script[turn++]
    if (!t) throw new Error('script exhausted')
    const parts = t.calls
      ? t.calls.map((c) => ({ functionCall: { name: c.name, args: c.args } }))
      : [{ text: t.text ?? '' }]
    return json({ candidates: [{ content: { role: 'model', parts } }] })
  }

  if (url.includes('/rest/v1/memory')) {
    const u = new URL(url)
    if (method === 'POST') {
      const p = JSON.parse(raw)
      memory[p.key] = { value: p.value, kind: p.kind }
      return json([p], 201)
    }
    const key = (u.searchParams.get('key') ?? '').replace('eq.', '')
    const row = memory[key] ? { value: memory[key].value } : null
    return json(headers.get('Accept')?.includes('pgrst.object') ? row : row ? [row] : [])
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
Deno.env.set('GOOGLE_SA_JSON', btoa(JSON.stringify({
  client_email: 'nixon-bot@nixon-508507.iam.gserviceaccount.com',
  private_key: `-----BEGIN PRIVATE KEY-----\n${btoa(bin).match(/.{1,64}/g)!.join('\n')}\n-----END PRIVATE KEY-----\n`,
})))

const g = await import(`${FN}/_shared/google.ts`)
const sub = await import(`${FN}/_shared/subagents.ts`)

// ============================================================ 1. folder URLs
console.log('\n1. a pasted Drive folder link becomes an id')
check(g.extractId(`https://drive.google.com/drive/folders/${ROOT}`) === ROOT, 'folder URL')
check(g.extractId(`https://drive.google.com/drive/folders/${ROOT}?usp=sharing`) === ROOT, 'with a query string')
check(g.extractId(ROOT) === ROOT, 'a bare id is left alone')
check(g.extractId('https://docs.google.com/document/d/DOC1/edit') === 'DOC1', 'doc URL still works')

// ============================================================== 2. drive_list
console.log('\n2. drive_list')
const files = await g.executeGoogleTool('drive_list', { folder_id: 'fold-helix' }) as Record<string, string>[]
check(files.length === 2, `2 files — got ${files.length}`)
check(files[0].kind === 'sheet' && files[1].kind === 'doc', 'mime types become plain kinds')
check(files[0].name === 'Lab logbook', 'names returned, so an agent can pick by name')
check(lastDriveQ.includes('trashed = false'), 'trashed files excluded')

// ================================================================ 3. doc_read
console.log('\n3. doc_read')
const doc = await g.executeGoogleTool('doc_read', { document_id: 'https://docs.google.com/document/d/DOC1/edit' }) as Record<string, unknown>
check(doc.title === 'Thesis draft', 'title returned')
check(String(doc.text).includes('Chapter one'), 'paragraphs read')
check(String(doc.text).includes('Plate A1'), 'text inside tables read too')
check(doc.truncated === false, 'short doc is not marked truncated')

// ================================================================= 4. scopes
console.log('\n4. scopes')
check(lastScopes.includes('drive.readonly'), 'asks for Drive read-only')
check(!lastScopes.includes('auth/drive '), 'does not ask for full Drive write access')

// ====================================================== 5. folder discovery
console.log('\n5. one root link configures all six agents')
memory[ 'drive.root_folder_id' ] = { value: `https://drive.google.com/drive/folders/${ROOT}`, kind: 'id' }
driveCalls = 0
const helixFolder = await sub.folderFor('helix')
check(helixFolder === 'fold-helix', `found Helix's folder — got ${helixFolder}`)
check(driveCalls === 1, `one Drive call — got ${driveCalls}`)
check(memory['drive.ember.folder_id']?.value === 'fold-ember', 'siblings cached in the same pass')
check(memory['drive.forge.folder_id']?.value === 'fold-forge', 'all six cached')
check(memory['drive.notes.txt.folder_id'] === undefined, 'a stray file is not mistaken for a folder')

console.log('\n6. the second lookup costs nothing')
driveCalls = 0
check(await sub.folderFor('ember') === 'fold-ember', 'served from memory')
check(driveCalls === 0, `no Drive call — got ${driveCalls}`)

console.log('\n7. no root registered yet')
const saved = memory['drive.root_folder_id']
delete memory['drive.root_folder_id']
delete memory['drive.ledger.folder_id']
check(await sub.folderFor('ledger') === null, 'returns null rather than throwing')
memory['drive.root_folder_id'] = saved

// ================================================== 8. the folder is injected
console.log('\n8. the agent is told where its folder is')
script = [{ text: 'reviewed' }]
turn = 0
geminiPrompts.length = 0
await sub.runSubagent('helix', 'summarise my lab logbook')
check(geminiPrompts[0].includes('fold-helix'), 'folder id reaches the model')
check(geminiPrompts[0].includes('drive_list'), 'and it is told how to use it')
check(geminiPrompts[0].endsWith('summarise my lab logbook'), "Nixon's request is preserved verbatim at the end")

console.log('\n9. every agent can look, none can write')
for (const a of ['helix', 'cadence', 'compass', 'ember', 'ledger', 'forge']) {
  const names = sub.SUBAGENTS[a].tools.map((t: { name: string }) => t.name)
  const canRead = ['drive_list', 'sheet_read', 'doc_read'].every((n) => names.includes(n))
  const canWrite = ['sheet_append_row', 'doc_append', 'calendar_create', 'telegram_send'].some((n) => names.includes(n))
  check(canRead && !canWrite, `${a}: reads its folder, cannot write`)
}
const refused = await sub.SUBAGENTS.ember.execute('doc_append', { document_id: 'x', text: 'ghostwritten' })
check(JSON.stringify(refused).includes('ask Nixon'), 'a write attempt is refused with a pointer to Nixon')

console.log('\n10. Nixon keeps the full set')
const { NIXON_TOOLS } = await import(`${FN}/_shared/tools.ts`)
const nixon = NIXON_TOOLS.map((t: { name: string }) => t.name)
for (const t of ['drive_list', 'doc_read', 'doc_append', 'sheet_append_row', 'calendar_create']) {
  check(nixon.includes(t), `Nixon has ${t}`)
}

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURES`)
if (failures) Deno.exit(1)
