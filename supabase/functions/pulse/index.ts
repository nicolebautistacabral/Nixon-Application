// Cron target. pg_cron calls this every hour at :00 and :15; this function
// decides from Lisbon time whether anything is due, which keeps the schedule
// correct across daylight saving without touching the cron entries.
import { getSetting, pruneProcessedUpdates, setSetting, trimMessages } from '../_shared/db.ts'
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

  // Housekeeping rides on the day-close pulse: it is the one moment nothing
  // else is happening, and it runs after Nicole has her message.
  if (mode === 'pulse_2200_close') {
    try {
      const trimmed = await trimMessages(chat, 200)
      await pruneProcessedUpdates(7)
      if (trimmed) console.log(`trimmed ${trimmed} old messages`)
    } catch (err) {
      console.error('nightly cleanup failed', err) // never worth failing the pulse
    }
  }

  return `${mode} sent`
}

/**
 * Checks the Google setup one layer at a time and says which layer broke.
 * Google's own errors do not distinguish "API not enabled" from "calendar not
 * shared", and both are easy to miss in a 14-step setup. Costs no model quota.
 */
export async function googleSelfTest(now: LisbonNow): Promise<string> {
  const lines: string[] = []
  const { executeGoogleTool } = await import('../_shared/google.ts')

  const sa = Deno.env.get('GOOGLE_SA_JSON')
  lines.push(sa ? `1. GOOGLE_SA_JSON is set (${sa.length} chars)` : '1. FAIL GOOGLE_SA_JSON is not set')
  if (!sa) return lines.join('\n')

  let email = '(unreadable)'
  try {
    let t = sa.trim()
    if (!t.startsWith('{')) t = atob(t.replace(/\s+/g, ''))
    email = JSON.parse(t).client_email ?? '(missing client_email)'
    lines.push(`2. service account = ${email}`)
  } catch (err) {
    lines.push(`2. FAIL could not read the key: ${err instanceof Error ? err.message : err}`)
    return lines.join('\n')
  }

  const calId = Deno.env.get('GOOGLE_CALENDAR_ID')
  lines.push(`3. GOOGLE_CALENDAR_ID = ${calId ?? '(not set — using "primary", which for a robot means its own empty calendar)'}`)
  if (calId && calId === email) {
    lines.push(
      `   → WRONG: that is the robot's own address. Events would go to its private calendar,`,
    )
    lines.push(
      `     which you cannot see. Set it to your own Gmail address instead.`,
    )
  }

  try {
    const today = await executeGoogleTool('calendar_list', {
      time_min_iso: `${now.date}T00:00:00`,
      time_max_iso: `${now.date}T23:59:59`,
    }) as unknown[]
    lines.push(`4. reading the calendar works (${today.length} events today)`)
  } catch (err) {
    const m = err instanceof Error ? err.message : String(err)
    lines.push(`4. FAIL cannot read the calendar: ${m}`)
    if (/Invalid JWT Signature|invalid_grant/i.test(m)) {
      // The key parsed fine, so the bytes are intact; Google is rejecting the
      // signature. That means the key it was signed with is no longer valid.
      lines.push(`   → Google does not recognise this key. Almost always it was deleted or`)
      lines.push(`     replaced in the console. Download a new JSON key for ${email}`)
      lines.push(`     and set GOOGLE_SA_JSON again from that file.`)
    } else if (/403|404|has not been used|disabled/i.test(m)) {
      lines.push(`   → share the calendar with ${email} as "Make changes to events",`)
      lines.push(`     and enable the Google Calendar API in the project`)
    } else {
      lines.push(`   → check the key and the calendar id`)
    }
    return lines.join('\n')
  }

  try {
    const ev = await executeGoogleTool('calendar_create', {
      title: 'Nixon self-test — safe to delete',
      start_iso: `${now.date}T23:30:00`,
      end_iso: `${now.date}T23:45:00`,
      description: 'Created by the Nixon self-test. Delete me.',
    }) as Record<string, unknown>
    lines.push(`5. writing to the calendar works → ${ev.htmlLink}`)
    lines.push('   Everything is connected. Delete that test event when you see it.')
  } catch (err) {
    const m = err instanceof Error ? err.message : String(err)
    lines.push(`5. FAIL cannot create events: ${m}`)
    lines.push(`   → the sharing permission must be "Make changes to events", not "See all event details"`)
  }
  return lines.join('\n')
}

Deno.serve(async (req) => {
  const expected = Deno.env.get('NIXON_CRON_SECRET')
  const given = req.headers.get('x-nixon-secret')
  if (!expected || given !== expected) return new Response('forbidden', { status: 403 })

  const now = lisbonNow()
  const params = new URL(req.url).searchParams

  if (params.get('selftest') === 'google') {
    const report = await googleSelfTest(now).catch((e) => `self-test crashed: ${e}`)
    console.log(report)
    return new Response(report, { status: 200, headers: { 'Content-Type': 'text/plain' } })
  }

  const forced = params.get('force')

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
