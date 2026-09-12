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
