// The six domain subagents. Each is a nested runAgent with its own system
// prompt and no conversation history — Nixon passes everything it needs.
import type { FunctionDeclaration } from 'npm:@google/genai@2'
import { runAgent, type ToolExecutor } from './gemini.ts'
import { NATURE_SEARCH_TOOL, natureSearch } from './nature.ts'
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

const noTools: ToolExecutor = (name) => Promise.resolve({ error: `no tool ${name} here` })

const helixTools: ToolExecutor = async (name, args) => {
  if (name === 'nature_search') return await natureSearch(String(args.query ?? ''))
  return { error: `no tool ${name} here` }
}

export const SUBAGENTS: Record<SubagentName, Subagent> = {
  // Helix is the only one that reads the literature; the rest work from what
  // Nixon hands them until Phase 5 gives them sheet_read.
  helix: { system: HELIX_SYSTEM, tools: [NATURE_SEARCH_TOOL], execute: helixTools },
  cadence: { system: CADENCE_SYSTEM, tools: [], execute: noTools },
  compass: { system: COMPASS_SYSTEM, tools: [], execute: noTools },
  ember: { system: EMBER_SYSTEM, tools: [], execute: noTools },
  ledger: { system: LEDGER_SYSTEM, tools: [], execute: noTools },
  forge: { system: FORGE_SYSTEM, tools: [], execute: noTools },
}

export function isSubagent(name: string): name is SubagentName {
  return name in SUBAGENTS
}

/** Run one subagent on a self-contained request and return its plain-text answer. */
export async function runSubagent(agent: string, request: string): Promise<string> {
  if (!isSubagent(agent)) return `No subagent named ${agent}.`
  const { system, tools, execute } = SUBAGENTS[agent]
  console.log(`delegate → ${agent}: ${request.slice(0, 160)}`)
  return await runAgent({
    system,
    history: [],
    userText: request,
    tools,
    execute,
    role: 'author', // lessons are the part worth spending the capable model on
    maxSteps: 8, // subagents only loop for nature_search
  })
}
