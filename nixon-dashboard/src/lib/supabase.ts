import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/**
 * Why this is not a top-level `throw`:
 *
 * Vite inlines `import.meta.env.*` at build time. A throw guarded by a check on
 * those values becomes unconditional once they are undefined, so the bundler
 * proves every later statement unreachable and drops the whole application. The
 * build still reports success and ships a blank page.
 *
 * So: report the problem as data, keep the module importable, and let the app
 * render something that says what is wrong.
 */
export const configError: string | null =
  !url || !anonKey
    ? 'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Add them to .env.local (local) or to the project\'s Environment Variables (Vercel), then build again.'
    : null

export const supabase = createClient(
  url || 'https://unconfigured.supabase.co',
  anonKey || 'unconfigured',
  { auth: { persistSession: true, autoRefreshToken: true } },
)
