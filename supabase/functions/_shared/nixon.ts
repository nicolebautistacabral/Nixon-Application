// One place where Nixon actually runs. Both the Telegram webhook and the
// scheduled pulse come through here, so they cannot drift apart.
import { loadHistory, saveTurn } from './db.ts'
import { runAgent } from './gemini.ts'
import { NIXON_PREFETCH_ADDENDUM, NIXON_SYSTEM } from './agents.ts'
import { NIXON_TOOLS, buildHeader, executeNixonTool } from './tools.ts'
import { lisbonNow } from './time.ts'

/**
 * @param chat    owner chat id
 * @param kind    header kind, e.g. "CHAT MESSAGE from Nicole" or "SCHEDULED PULSE pulse_0700_cadence"
 * @param text    the instruction or her message
 * @param record  what to store as the user turn; pulses store their own label
 */
export async function runNixon(
  chat: string,
  kind: string,
  text: string,
  record = text,
): Promise<string> {
  const now = lisbonNow()
  // Memory and state are read from Postgres rather than by the model, which
  // saves two Gemini requests out of a small daily budget.
  const [history, header] = await Promise.all([
    loadHistory(chat, 30),
    buildHeader(kind, now),
  ])
  const reply = await runAgent({
    system: NIXON_SYSTEM + NIXON_PREFETCH_ADDENDUM,
    history,
    userText: `${header}\n${text}`,
    tools: NIXON_TOOLS,
    execute: executeNixonTool,
    role: 'coordinator',
  })
  await saveTurn(chat, 'user', record)
  await saveTurn(chat, 'model', reply)
  return reply
}
