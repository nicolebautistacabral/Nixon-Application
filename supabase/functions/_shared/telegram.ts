// Telegram Bot API — plain-text sendMessage with 4000-char chunking.

const LIMIT = 4000

export function chunkText(text: string, limit = LIMIT): string[] {
  const out: string[] = []
  let rest = text
  while (rest.length > limit) {
    let cut = rest.lastIndexOf('\n', limit)
    if (cut <= 0) cut = limit // no newline in range → hard cut
    out.push(rest.slice(0, cut))
    rest = rest.slice(cut).replace(/^\n/, '')
  }
  if (rest.length) out.push(rest)
  return out
}

function api(method: string): string {
  const token = Deno.env.get('TELEGRAM_BOT_TOKEN')
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN not set')
  return `https://api.telegram.org/bot${token}/${method}`
}

export async function sendMessage(chatId: string | number, text: string): Promise<void> {
  for (const chunk of chunkText(text)) {
    const res = await fetch(api('sendMessage'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: chunk,
        disable_web_page_preview: true,
      }),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`telegram sendMessage ${res.status}: ${body}`)
    }
  }
}
