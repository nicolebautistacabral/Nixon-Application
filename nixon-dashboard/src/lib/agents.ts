import type { Agent } from '../types/db'

export type AgentDef = {
  name: string
  key: Agent
  role: string
  color: string
  size: 'sm' | 'md' | 'lg'
  pos: { left?: string; right?: string; top: string }
}

// Nixon is the brain in the middle, not a bubble.
export const AGENTS: AgentDef[] = [
  { name: 'Ember',   key: 'ember',   role: 'Creative',     color: '#F97316', size: 'md', pos: { left: '8%',  top: '40%' } },
  { name: 'Compass', key: 'compass', role: 'Professional', color: '#3B82F6', size: 'sm', pos: { left: '18%', top: '55%' } },
  { name: 'Helix',   key: 'helix',   role: 'Scientist',    color: '#06B6D4', size: 'lg', pos: { left: '6%',  top: '75%' } },
  { name: 'Forge',   key: 'forge',   role: 'Builder',      color: '#6366F1', size: 'lg', pos: { right: '8%', top: '18%' } },
  { name: 'Cadence', key: 'cadence', role: 'Linguist',     color: '#F472B6', size: 'md', pos: { right: '8%', top: '45%' } },
  { name: 'Ledger',  key: 'ledger',  role: 'Hustler',      color: '#FBBF24', size: 'md', pos: { right: '10%', top: '72%' } },
]

export const SIZE_PX: Record<AgentDef['size'], number> = { sm: 100, md: 130, lg: 170 }

export const byKey = (k: string): AgentDef | undefined =>
  AGENTS.find((a) => a.key === k.toLowerCase() || a.name.toLowerCase() === k.toLowerCase())

/** Nixon's own colour, for tasks the coordinator holds itself. */
export const NIXON_COLOR = '#A855F7'

export const agentColor = (k: string): string => byKey(k)?.color ?? NIXON_COLOR
export const agentLabel = (k: string): string =>
  byKey(k)?.name ?? k.charAt(0).toUpperCase() + k.slice(1)
