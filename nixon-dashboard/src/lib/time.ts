const TZ = 'Europe/Lisbon'

/** Today's date in Lisbon as YYYY-MM-DD, matching what the agent writes. */
export function lisbonToday(d: Date = new Date()): string {
  const p: Record<string, string> = {}
  for (const part of new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(d)) {
    if (part.type !== 'literal') p[part.type] = part.value
  }
  return `${p.year}-${p.month}-${p.day}`
}

const fmt = (d: Date, o: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('en-GB', { timeZone: TZ, ...o }).format(d)

export type Deadline = { label: string; overdue: boolean }

/** "Today 15:00" · "Fri 17:00" · "Overdue 2d" · "" when there is no deadline. */
export function formatDeadline(iso: string | null, now: Date = new Date()): Deadline {
  if (!iso) return { label: '', overdue: false }
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return { label: '', overdue: false }

  const time = fmt(d, { hour: '2-digit', minute: '2-digit', hour12: false })
  const day = lisbonToday(d)
  const today = lisbonToday(now)

  if (d.getTime() < now.getTime()) {
    const mins = Math.round((now.getTime() - d.getTime()) / 60000)
    if (mins < 60) return { label: `Overdue ${mins}m`, overdue: true }
    const hours = Math.round(mins / 60)
    if (hours < 24) return { label: `Overdue ${hours}h`, overdue: true }
    return { label: `Overdue ${Math.round(hours / 24)}d`, overdue: true }
  }

  if (day === today) return { label: `Today ${time}`, overdue: false }

  const tomorrow = lisbonToday(new Date(now.getTime() + 86400000))
  if (day === tomorrow) return { label: `Tomorrow ${time}`, overdue: false }

  const withinWeek = d.getTime() - now.getTime() < 7 * 86400000
  return {
    label: withinWeek
      ? `${fmt(d, { weekday: 'short' })} ${time}`
      : `${fmt(d, { day: 'numeric', month: 'short' })} ${time}`,
    overdue: false,
  }
}

/** Short clock for chat bubbles. */
export const formatTime = (iso: string): string =>
  fmt(new Date(iso), { hour: '2-digit', minute: '2-digit', hour12: false })

export const formatDay = (iso: string): string =>
  fmt(new Date(iso), { weekday: 'short', day: 'numeric', month: 'short' })
