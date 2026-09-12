// Telegram webhook: verify secret → handle /start or echo → always 200.
import { getSetting, setSetting } from '../_shared/db.ts'
import { sendMessage } from '../_shared/telegram.ts'

export const HELP_CARD = `👋 Hi Nicole — Nixon here. Just talk to me.
• "Remember: my lab logbook sheet is <link>"
• "Add: submit WP2 report by Friday 17:00"
• "Done with the Portuguese" / "Finished the Elif evaluation"
• "What's open for Ember?"
Daily: 07:00 lesson → DONE → round-up → Helix → DONE → quiz → to-do · 12:00 · 18:00 · 22:00 close · 22:15 recap`

type Update = {
  update_id?: number
  message?: { chat?: { id?: number | string }; text?: string }
}

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

  // Phase 2: echo. Phase 3 replaces this with the Nixon agent.
  await sendMessage(chat, text)
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

  try {
    await handleUpdate(update)
  } catch (err) {
    console.error('telegram handler error', err)
  }
  return ok()
})
