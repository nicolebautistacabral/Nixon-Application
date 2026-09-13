import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import Logo from '../components/Logo'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    setBusy(false)
  }

  return (
    <main className="min-h-screen grid place-items-center px-5 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center"><Logo /></div>
        <form
          onSubmit={submit}
          className="rounded-3xl border border-white/30 bg-gradient-to-br from-white/25 via-white/10 to-white/5 p-6 backdrop-blur-md shadow-2xl"
        >
          <label className="block text-xs uppercase tracking-[0.12em] opacity-90" htmlFor="email">Email</label>
          <input
            id="email" type="email" autoComplete="email" required value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1.5 mb-4 w-full rounded-xl border border-white/30 bg-white/15 px-3 py-3 text-white placeholder-white/50 outline-none focus:border-white/70"
            placeholder="you@example.com"
          />
          <label className="block text-xs uppercase tracking-[0.12em] opacity-90" htmlFor="password">Password</label>
          <input
            id="password" type="password" autoComplete="current-password" required value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-white/30 bg-white/15 px-3 py-3 text-white placeholder-white/50 outline-none focus:border-white/70"
            placeholder="••••••••"
          />
          {error && (
            <p className="mt-4 rounded-lg bg-red-500/25 border border-red-300/40 px-3 py-2 text-sm">{error}</p>
          )}
          <button
            type="submit" disabled={busy}
            className="mt-6 w-full rounded-xl bg-white/90 py-3 font-semibold text-nav-text transition hover:bg-white disabled:opacity-60"
          >
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p className="mt-5 text-center text-xs opacity-70">Private. One account, hers.</p>
      </div>
    </main>
  )
}
