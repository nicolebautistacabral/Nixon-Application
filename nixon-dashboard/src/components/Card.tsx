import type { ReactNode } from 'react'

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl border border-white/25 bg-gradient-to-br from-white/20 via-white/10 to-white/5 backdrop-blur-md shadow-lg ${className}`}
    >
      {children}
    </div>
  )
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-3 font-sans text-xs font-semibold uppercase tracking-[0.16em] opacity-90">
      {children}
    </h2>
  )
}

export function Empty({ title, hint }: { title: string; hint: string }) {
  return (
    <Card className="p-5 text-center">
      <p className="font-medium">{title}</p>
      <p className="mt-1.5 text-sm opacity-80">{hint}</p>
    </Card>
  )
}

export function ErrorNote({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-red-300/40 bg-red-500/25 p-4 text-sm" role="alert">
      Could not load this. {message}
    </div>
  )
}
