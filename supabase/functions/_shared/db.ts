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
