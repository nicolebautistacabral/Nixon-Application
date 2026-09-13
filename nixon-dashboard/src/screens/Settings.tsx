import { useMemo, useState } from 'react'
import { Card, Empty, ErrorNote, SectionTitle } from '../components/Card'
import { SkeletonList } from '../components/Skeleton'
import { getMemory, upsertMemory } from '../lib/queries'
import { useLive } from '../hooks/useLive'
import { useAuth } from '../context/AuthContext'
import type { Memory } from '../types/db'

const GROUPS: { title: string; kinds: Memory['kind'][]; hint: string }[] = [
  { title: 'Connected files', kinds: ['id'], hint: 'Tell Nixon: "Remember: my competitions sheet is <link>"' },
  { title: 'Standing orders', kinds: ['instruction'], hint: 'Tell Nixon: "Remember: always confirm before sending to a student"' },
  { title: 'About me', kinds: ['preference', 'fact'], hint: 'Tell Nixon anything worth remembering and it lands here.' },
]

export default function Settings() {
  const { data, loading, error, reload } = useLive<Memory[]>('memory', getMemory, [])
  const { signOut } = useAuth()

  const grouped = useMemo(
    () => GROUPS.map((g) => ({ ...g, rows: data.filter((m) => g.kinds.includes(m.kind)) })),
    [data],
  )

  return (
    <main className="mx-auto w-full max-w-2xl px-4 pt-6 sm:px-6">
      <h1 className="font-cursive text-4xl">Settings</h1>

      {loading ? <div className="mt-5"><SkeletonList n={3} /></div>
        : error ? <div className="mt-5"><ErrorNote message={error} /></div>
        : (
          <div className="mt-5 space-y-7">
            {grouped.map((g) => (
              <section key={g.title}>
                <SectionTitle>{g.title}</SectionTitle>
                {g.rows.length === 0
                  ? <Empty title="Nothing here yet." hint={g.hint} />
                  : (
                    <Card className="divide-y divide-white/10">
                      {g.rows.map((m) => <MemoryRow key={m.key} row={m} onSaved={reload} />)}
                    </Card>
                  )}
              </section>
            ))}
          </div>
        )}

      <button
        onClick={signOut}
        className="mt-9 w-full rounded-xl border border-white/30 bg-white/15 py-3 font-semibold backdrop-blur-md transition hover:bg-white/25"
      >
        Sign out
      </button>
      <p className="mt-3 text-center text-xs opacity-70">
        Nixon owns deleting. Ask it in Telegram to forget something.
      </p>
    </main>
  )
}

function MemoryRow({ row, onSaved }: { row: Memory; onSaved: () => void }) {
  const [value, setValue] = useState(row.value)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const dirty = value !== row.value

  async function save() {
    setBusy(true)
    setError(null)
    try {
      await upsertMemory(row.key, value, row.kind)
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="p-4">
      <label className="block text-xs opacity-70" htmlFor={`m-${row.key}`}>{row.key}</label>
      <div className="mt-1.5 flex flex-wrap gap-2">
        <input
          id={`m-${row.key}`}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="min-w-0 flex-1 rounded-xl border border-white/30 bg-white/15 px-3 py-2.5 text-white outline-none focus:border-white/70"
        />
        {dirty && (
          <button
            onClick={save} disabled={busy}
            className="rounded-xl bg-white/90 px-4 py-2.5 text-sm font-semibold text-nav-text transition hover:bg-white disabled:opacity-60"
          >
            {busy ? 'Saving…' : 'Save'}
          </button>
        )}
      </div>
      {error && <p className="mt-2 text-sm text-red-200">{error}</p>}
    </div>
  )
}
