import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

type Table = 'tasks' | 'memory' | 'daily_state' | 'learning' | 'messages'

export type Live<T> = { data: T; loading: boolean; error: string | null; reload: () => void }

/**
 * Runs `fetcher`, then re-runs it whenever the agent writes to `table`, so the
 * screen updates the instant something changes in Telegram.
 */
export function useLive<T>(table: Table, fetcher: () => Promise<T>, initial: T): Live<T> {
  const [data, setData] = useState<T>(initial)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const alive = useRef(true)
  const run = useRef(fetcher)
  run.current = fetcher
  // Two components can watch the same table — the nav and a screen both watch
  // `tasks`. Channel names must differ, or the second subscription is refused
  // with "cannot add postgres_changes callbacks after subscribe()".
  const instance = useId()

  const load = useCallback(async () => {
    try {
      const next = await run.current()
      if (alive.current) { setData(next); setError(null) }
    } catch (e) {
      if (alive.current) setError(e instanceof Error ? e.message : String(e))
    } finally {
      if (alive.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    alive.current = true
    load()
    const channel = supabase
      .channel(`live:${table}:${instance}`)
      .on('postgres_changes', { event: '*', schema: 'public', table }, () => load())
      .subscribe()
    return () => {
      alive.current = false
      supabase.removeChannel(channel)
    }
  }, [table, load, instance])

  return { data, loading, error, reload: load }
}
