// Telegram webhook: verify secret → /start or run Nixon → always 200 fast.
import { getSetting, setSetting } from '../_shared/db.ts'
import { sendMessage } from '../_shared/telegram.ts'
import { runNixon } from '../_shared/nixon.ts'

export const HELP_CARD = `👋 Hi Nicole — Nixon here. Just talk to me.
• "Remember: my lab logbook sheet is <link>"
• "Add: submit WP2 report by Friday 17:00"
• "Done with the Portuguese" / "Finished the Elif evaluation"
• "What's open for Ember?"
Daily: 07:00 lesson → DONE → round-up → Helix → DONE → quiz → to-do · 12:00 · 18:00 · 22:00 close · 22:15 recap`

const APOLOGY = 'Something broke on my side — try again in a minute.'

type Update = {
  update_id?: number
  message?: { chat?: { id?: number | string }; text?: string }
}

// Supabase edge runtime exposes this; absent when running plain Deno.
declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined

const ok = (body = 'ok') => new Response(body, { status: 200 })

export async function handleUpdate(update: Update): Promise<void> {
  const chatId = update.message?.chat?.id
  const text = update.message?.text?.trim()
  if (chatId === undefined || !text) return // stickers, edits, joins… ignore

  const chat = String(chatId)
  const owner = await getSetting('owner_chat_id')

  if (owner && owner !== chat) {
    console.log(`ignored message from non-owner chat ${chat}`)
    return
  }

  if (text === '/start' || text.startsWith('/start ')) {
    if (!owner) await setSetting('owner_chat_id', chat)
    await sendMessage(chat, HELP_CARD)
    return
  }

  if (!owner) {
    await sendMessage(chat, 'Send /start first so I know this is you.')
    return
  }

  try {
    const reply = await runNixon(chat, 'CHAT MESSAGE from Nicole', text)
    await sendMessage(chat, reply)
  } catch (err) {
    console.error('nixon error', err)
    await sendMessage(chat, APOLOGY).catch((e) => console.error('apology failed', e))
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('nixon telegram webhook', { status: 200 })

  const expected = Deno.env.get('TELEGRAM_WEBHOOK_SECRET')
  const given = req.headers.get('X-Telegram-Bot-Api-Secret-Token')
  if (!expected || given !== expected) return new Response('forbidden', { status: 403 })

  let update: Update
  try {
    update = await req.json()
  } catch {
    return ok('bad json')
  }

  const work = handleUpdate(update).catch((err) => console.error('telegram handler error', err))
  if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime) {
    EdgeRuntime.waitUntil(work) // reply 200 now; Telegram won't re-deliver while Gemini thinks
  } else {
    await work
  }
  return ok()
})
