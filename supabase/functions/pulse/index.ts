// Cron target. pg_cron calls this every hour at :00 and :15; this function
// decides from Lisbon time whether anything is due, which keeps the schedule
// correct across daylight saving without touching the cron entries.
import { getSetting, setSetting } from '../_shared/db.ts'
import { sendMessage } from '../_shared/telegram.ts'
import { runNixon } from '../_shared/nixon.ts'
import { lisbonNow, type LisbonNow } from '../_shared/time.ts'

export const MODES = [
  'pulse_0700_cadence',
  'pulse_1200_midday',
  'pulse_1800_evening',
  'pulse_2200_close',
  'pulse_2215_recap',
] as const
export type Mode = typeof MODES[number]

/** One line per pulse; the system prompt already spells out what each means. */
const TASK: Record<Mode, string> = {
  pulse_0700_cadence:
    "Start Nicole's day: set up today's state row and send this morning's Portuguese lesson.",
  pulse_1200_midday: 'Midday check-in.',
  pulse_1800_evening: 'Evening check-in.',
  pulse_2200_close: 'Close the day.',
  pulse_2215_recap: "Send tonight's recap quiz on today's Portuguese and Helix lesson.",
}

/** Cron can run a little late, so each slot is a window rather than a minute. */
export function modeFor(now: LisbonNow): Mode | null {
  const onTheHour = now.minute < 10
  const quarterPast = now.minute >= 15 && now.minute < 25
  if (now.hour === 7 && onTheHour) return 'pulse_0700_cadence'
  if (now.hour === 12 && onTheHour) return 'pulse_1200_midday'
  if (now.hour === 18 && onTheHour) return 'pulse_1800_evening'
  if (now.hour === 22 && onTheHour) return 'pulse_2200_close'
  if (now.hour === 22 && quarterPast) return 'pulse_2215_recap'
  return null
}

const isMode = (s: string): s is Mode => (MODES as readonly string[]).includes(s)

export async function runPulse(mode: Mode, now: LisbonNow, force: boolean): Promise<string> {
  const chat = await getSetting('owner_chat_id')
  if (!chat) return 'no owner yet — send /start to the bot first'

  // A retried cron call must not send the morning lesson twice; that would
  // both confuse Nicole and spend scarce model quota.
  const alreadyKey = `pulse.${mode}`
  if (!force && (await getSetting(alreadyKey)) === now.date) {
    return `${mode} already sent today`
  }

  const reply = await runNixon(chat, `SCHEDULED PULSE ${mode}`, TASK[mode], `[${mode}]`)
  await sendMessage(chat, reply)
  await setSetting(alreadyKey, now.date)
  return `${mode} sent`
}

Deno.serve(async (req) => {
  const expected = Deno.env.get('NIXON_CRON_SECRET')
  const given = req.headers.get('x-nixon-secret')
  if (!expected || given !== expected) return new Response('forbidden', { status: 403 })

  const now = lisbonNow()
  const forced = new URL(req.url).searchParams.get('force')

  if (forced && !isMode(forced)) {
    return new Response(`unknown mode ${forced}. Try one of: ${MODES.join(', ')}`, { status: 400 })
  }

  const mode = forced ? forced as Mode : modeFor(now)
  if (!mode) {
    return new Response(`no-op at ${now.label}`, { status: 200 })
  }

  try {
    const result = await runPulse(mode, now, Boolean(forced))
    console.log(result)
    return new Response(result, { status: 200 })
  } catch (err) {
    console.error(`pulse ${mode} failed`, err)
    // 200 so pg_cron does not pile up retries; the log carries the detail.
    return new Response(`pulse ${mode} failed: ${err instanceof Error ? err.message : err}`, {
      status: 200,
    })
  }
})
