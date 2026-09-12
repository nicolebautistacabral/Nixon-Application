import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'

type Status = 'checking' | 'connected' | 'error'

// Phase 1 smoke screen. Replaced by the real shell in Phase 4.
export default function App() {
  const [status, setStatus] = useState<Status>('checking')
  const [detail, setDetail] = useState('')

  useEffect(() => {
    supabase
      .from('settings')
      .select('key', { count: 'exact', head: true })
      .then(({ error, count }) => {
        if (error) {
          // With RLS on and no policies, the anon key gets an empty result, not
          // an error — so any error here is a URL/key/network problem.
          setStatus('error')
          setDetail(error.message)
        } else {
          setStatus('connected')
          setDetail(`settings rows visible to anon: ${count ?? 0}`)
        }
      })
  }, [])

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="font-sans text-xs uppercase tracking-[0.2em]">✿ Nicole's Polymath Assistant ✿</p>
      <h1 className="font-cursive text-7xl drop-shadow-lg">Nixon</h1>
      <p className="font-sans text-sm">
        Supabase: {status === 'checking' && 'checking…'}
        {status === 'connected' && '✅ connected'}
        {status === 'error' && '❌ not connected'}
      </p>
      {detail && <p className="font-sans text-xs opacity-80">{detail}</p>}
    </main>
  )
}
