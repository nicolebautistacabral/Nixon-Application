// The six domain subagents. Each is a nested runAgent with its own system
// prompt and no conversation history — Nixon passes everything it needs.
import type { FunctionDeclaration } from 'npm:@google/genai@2'
import { runAgent, type ToolExecutor } from './gemini.ts'
import { NATURE_SEARCH_TOOL, natureSearch } from './nature.ts'
import { SUBAGENT_READ_NAMES, SUBAGENT_READ_TOOLS, executeGoogleTool, extractId } from './google.ts'
import { db } from './db.ts'
import {
  CADENCE_SYSTEM,
  COMPASS_SYSTEM,
  EMBER_SYSTEM,
  FORGE_SYSTEM,
  HELIX_SYSTEM,
  LEDGER_SYSTEM,
} from './agents.ts'

export type SubagentName = 'helix' | 'cadence' | 'compass' | 'ember' | 'ledger' | 'forge'

type Subagent = {
  system: string
  tools: FunctionDeclaration[]
  execute: ToolExecutor
}

/** Each agent may look inside its own Drive folder and read what is there.
 *  Every write — calendar, appending to a sheet or doc, messaging a student —
 *  stays with Nixon. */
const readOnly: ToolExecutor = async (name, args) => {
  if (SUBAGENT_READ_NAMES.has(name)) return await executeGoogleTool(name, args)
  return { error: `no tool ${name} here — ask Nixon to do it` }
}

const helixTools: ToolExecutor = async (name, args) => {
  if (name === 'nature_search') return await natureSearch(String(args.query ?? ''))
  return await readOnly(name, args)
}

export const SUBAGENTS: Record<SubagentName, Subagent> = {
  // Helix is the only one that also reads the literature.
  helix: {
    system: HELIX_SYSTEM,
    tools: [NATURE_SEARCH_TOOL, ...SUBAGENT_READ_TOOLS],
    execute: helixTools,
  },
  cadence: { system: CADENCE_SYSTEM, tools: SUBAGENT_READ_TOOLS, execute: readOnly },
  compass: { system: COMPASS_SYSTEM, tools: SUBAGENT_READ_TOOLS, execute: readOnly },
  ember: { system: EMBER_SYSTEM, tools: SUBAGENT_READ_TOOLS, execute: readOnly },
  ledger: { system: LEDGER_SYSTEM, tools: SUBAGENT_READ_TOOLS, execute: readOnly },
  forge: { system: FORGE_SYSTEM, tools: SUBAGENT_READ_TOOLS, execute: readOnly },
}

export function isSubagent(name: string): name is SubagentName {
  return name in SUBAGENTS
}

// ------------------------------------------------------------ Drive folders

const memoryKey = (agent: string) => `drive.${agent}.folder_id`
const ROOT_KEY = 'drive.root_folder_id'

async function readMemory(key: string): Promise<string | null> {
  const { data, error } = await db.from('memory').select('value').eq('key', key).maybeSingle()
  if (error) { console.error(`memory read ${key} failed`, error); return null }
  return (data?.value as string | undefined) ?? null
}

async function writeMemory(key: string, value: string): Promise<void> {
  const { error } = await db.from('memory').upsert(
    { key, value, kind: 'id', updated_at: new Date().toISOString() },
    { onConflict: 'key' },
  )
  if (error) console.error(`memory write ${key} failed`, error)
}

/**
 * The folder this agent owns.
 *
 * Nicole registers one link — the parent folder — and the sub-folders are found
 * by name from there and remembered, so she never has to register six of them
 * or keep them in sync when she renames one.
 */
export async function folderFor(agent: SubagentName): Promise<string | null> {
  const known = await readMemory(memoryKey(agent))
  if (known) return extractId(known)

  const root = await readMemory(ROOT_KEY)
  if (!root) return null

  const listed = await executeGoogleTool('drive_list', { folder_id: root })
  if (!Array.isArray(listed)) {
    console.warn('drive_list failed while resolving folders', listed)
    return null
  }

  let mine: string | null = null
  for (const f of listed as { id: string; name: string; kind: string }[]) {
    if (f.kind !== 'folder') continue
    const key = memoryKey(f.name.trim().toLowerCase())
    // Cache every sibling while we are here; the next agent then costs nothing.
    await writeMemory(key, f.id)
    if (f.name.trim().toLowerCase() === agent) mine = f.id
  }
  if (!mine) console.warn(`no Drive folder named "${agent}" under the root folder`)
  return mine
}

/** Run one subagent on a self-contained request and return its plain-text answer. */
export async function runSubagent(agent: string, request: string): Promise<string> {
  if (!isSubagent(agent)) return `No subagent named ${agent}.`
  const { system, tools, execute } = SUBAGENTS[agent]

  // Tell it where its own files live, so Nixon does not have to remember to.
  let context = ''
  try {
    const folder = await folderFor(agent)
    if (folder) {
      context =
        `Your Drive folder id is ${folder}. ` +
        `Call drive_list on it to see the sheets and docs Nicole keeps there, then ` +
        `sheet_read or doc_read whichever you need. Do this whenever the answer ` +
        `depends on her actual files rather than general knowledge.\n\n`
    }
  } catch (err) {
    console.error('folder lookup failed, continuing without it', err)
  }

  console.log(`delegate → ${agent}: ${request.slice(0, 160)}`)
  return await runAgent({
    system,
    history: [],
    userText: context + request,
    tools,
    execute,
    role: 'author', // lessons are the part worth spending the capable model on
    maxSteps: 8,
  })
}
