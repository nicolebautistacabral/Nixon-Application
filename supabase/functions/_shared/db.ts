// Service-role Supabase client for edge functions (bypasses RLS).
import { createClient } from 'npm:@supabase/supabase-js@2'

const url = Deno.env.get('SUPABASE_URL')
const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
if (!url || !key) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set')

export const db = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
})

export async function getSetting(key: string): Promise<string> {
  const { data, error } = await db.from('settings').select('value').eq('key', key).maybeSingle()
  if (error) throw error
  return data?.value ?? ''
}

export async function setSetting(key: string, value: string): Promise<void> {
  const { error } = await db.from('settings').upsert({ key, value })
  if (error) throw error
}

// --- conversation memory ----------------------------------------------------
export type HistoryTurn = { role: 'user' | 'model'; parts: { text: string }[] }

/** Last `limit` messages for a chat, oldest first, in Gemini Content shape. */
export async function loadHistory(chatId: string, limit = 30): Promise<HistoryTurn[]> {
  const { data, error } = await db
    .from('messages')
    .select('role, content')
    .eq('chat_id', chatId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? [])
    .reverse()
    .map((m) => ({ role: m.role as 'user' | 'model', parts: [{ text: m.content as string }] }))
}

export async function saveTurn(chatId: string, role: 'user' | 'model', content: string): Promise<void> {
  const { error } = await db.from('messages').insert({ chat_id: chatId, role, content })
  if (error) throw error
}

// --- housekeeping -----------------------------------------------------------

/**
 * Records an update id and reports whether it is new. Telegram re-delivers when
 * it does not get a prompt 200, and the agent runs after the 200 is sent, so a
 * retry would otherwise redo the work: a duplicate lesson, a duplicate calendar
 * event, and another bite out of a small daily model budget.
 */
export async function claimUpdate(updateId: number): Promise<boolean> {
  const { error } = await db.from('processed_updates').insert({ update_id: updateId })
  if (!error) return true
  if (error.code === '23505') return false // primary key conflict: already seen
  // Any other failure (table missing, network) must not block the message.
  console.error('claimUpdate failed, processing anyway', error)
  return true
}

/** Keeps `messages` from growing without bound. Ids are serial, so id order is
 *  insertion order. Returns how many rows went. */
export async function trimMessages(chatId: string, keep = 200): Promise<number> {
  const { data, error } = await db
    .from('messages')
    .select('id')
    .eq('chat_id', chatId)
    .order('id', { ascending: false })
    .range(keep, keep) // the first row past the ones we keep
  if (error) throw error
  const cutoff = data?.[0]?.id
  if (cutoff === undefined) return 0

  const { data: gone, error: delError } = await db
    .from('messages')
    .delete()
    .eq('chat_id', chatId)
    .lte('id', cutoff)
    .select('id')
  if (delError) throw delError
  return gone?.length ?? 0
}

/** Drops de-duplication rows older than a week; they have no value after that. */
export async function pruneProcessedUpdates(days = 7): Promise<void> {
  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString()
  const { error } = await db.from('processed_updates').delete().lt('seen_at', cutoff)
  if (error) console.error('pruneProcessedUpdates failed', error)
}
