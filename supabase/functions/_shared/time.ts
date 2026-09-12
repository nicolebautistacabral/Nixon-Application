// Europe/Lisbon date/time helpers (DST-safe via Intl).
const TZ = 'Europe/Lisbon'

export type LisbonNow = {
  iso: string      // UTC instant, e.g. 2026-09-12T22:10:00.000Z
  date: string     // Lisbon calendar date YYYY-MM-DD
  weekday: string  // e.g. Saturday
  hour: number     // Lisbon hour 0-23
  minute: number   // Lisbon minute 0-59
  label: string    // e.g. Sat 12 Sep 2026 23:10
}

function parts(d: Date, opts: Intl.DateTimeFormatOptions): Record<string, string> {
  const out: Record<string, string> = {}
  for (const p of new Intl.DateTimeFormat('en-GB', { timeZone: TZ, ...opts }).formatToParts(d)) {
    if (p.type !== 'literal') out[p.type] = p.value
  }
  return out
}

export function lisbonNow(d: Date = new Date()): LisbonNow {
  const p = parts(d, {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false, weekday: 'long',
  })
  const hour = Number(p.hour) % 24 // en-GB can emit "24" at midnight
  const short = parts(d, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
  return {
    iso: d.toISOString(),
    date: `${p.year}-${p.month}-${p.day}`,
    weekday: p.weekday,
    hour,
    minute: Number(p.minute),
    label: `${short.weekday} ${short.day} ${short.month} ${short.year} ${String(hour).padStart(2, '0')}:${p.minute}`,
  }
}

/** Lisbon date N days before/after a YYYY-MM-DD date string. */
export function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}
