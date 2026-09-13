import { useEffect, useRef } from 'react'
import { ErrorNote } from '../components/Card'
import { SkeletonList } from '../components/Skeleton'
import { getMessages } from '../lib/queries'
import { useLive } from '../hooks/useLive'
import { formatTime } from '../lib/time'
import { botLink } from '../lib/phase'
import type { Message } from '../types/db'

export default function Chat() {
  const { data, loading, error } = useLive<Message[]>('messages', () => getMessages(60), [])
  const end = useRef<HTMLDivElement>(null)

  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth' }) }, [data.length])

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col px-4 pt-6 sm:px-6">
      <h1 className="font-cursive text-4xl">Chat</h1>

      <div className="mt-5 space-y-3">
        {loading ? <SkeletonList n={3} />
          : error ? <ErrorNote message={error} />
          : data.length === 0 ? (
            <p className="rounded-2xl border border-white/25 bg-white/10 p-5 text-center text-sm opacity-90">
              Nothing yet. Send your bot a message in Telegram and it appears here.
            </p>
          ) : data.map((m) => (
            <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 backdrop-blur-md ${
                  m.role === 'user'
                    ? 'rounded-br-md bg-white/85 text-nav-text'
                    : 'rounded-bl-md border border-white/25 bg-white/15'
                }`}
              >
                <p className="whitespace-pre-wrap break-words text-[15px]">{m.content}</p>
                <p className={`mt-1 text-[11px] ${m.role === 'user' ? 'text-nav-text/60' : 'opacity-65'}`}>
                  {formatTime(m.created_at)}
                </p>
              </div>
            </div>
          ))}
        <div ref={end} />
      </div>

      <div className="sticky bottom-0 mt-5 rounded-2xl border border-white/25 bg-white/10 p-3 backdrop-blur-md">
        <p className="text-center text-sm opacity-90">
          Reply in Telegram — messages appear here live.{' '}
          <a href={botLink()} target="_blank" rel="noreferrer" className="inline-link font-semibold underline">
            Open
          </a>
        </p>
      </div>
    </main>
  )
}
