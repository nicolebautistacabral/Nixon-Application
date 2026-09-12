// Google Calendar / Sheets / Docs via a service-account JWT.
// No OAuth dance: Nixon signs its own assertion and swaps it for an access
// token, which is cached for 50 of its 60 minutes.
import { Type, type FunctionDeclaration } from 'npm:@google/genai@2'
import type { ToolExecutor } from './gemini.ts'

const TZ = 'Europe/Lisbon'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/documents',
].join(' ')

type ServiceAccount = { client_email: string; private_key: string }

// ----------------------------------------------------------------- encoding
const b64url = (bytes: ArrayBuffer | Uint8Array): string => {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  let bin = ''
  for (const b of arr) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
const b64urlJson = (o: unknown) => b64url(new TextEncoder().encode(JSON.stringify(o)))

function pemToDer(pem: string): ArrayBuffer {
  const body = pem
    .replace(/-----BEGIN [^-]+-----/, '')
    .replace(/-----END [^-]+-----/, '')
    .replace(/\s+/g, '')
  const bin = atob(body)
  const der = new Uint8Array(new ArrayBuffer(bin.length))
  for (let i = 0; i < bin.length; i++) der[i] = bin.charCodeAt(i)
  return der.buffer
}

// ------------------------------------------------------------ service account
function serviceAccount(): ServiceAccount {
  const raw = Deno.env.get('GOOGLE_SA_JSON')
  if (!raw) {
    throw new Error(
      'GOOGLE_SA_JSON is not set. Run: supabase secrets set GOOGLE_SA_JSON="$(base64 -w0 key.json)"',
    )
  }
  // Accept base64 (as documented) or raw JSON, since both are easy to paste.
  let text = raw.trim()
  if (!text.startsWith('{')) {
    try {
      text = new TextDecoder().decode(
        Uint8Array.from(atob(text.replace(/\s+/g, '')), (c) => c.charCodeAt(0)),
      )
    } catch {
      throw new Error('GOOGLE_SA_JSON is neither JSON nor valid base64')
    }
  }
  let sa: ServiceAccount
  try {
    sa = JSON.parse(text)
  } catch {
    throw new Error('GOOGLE_SA_JSON did not parse as JSON')
  }
  if (!sa.client_email || !sa.private_key) {
    throw new Error('GOOGLE_SA_JSON is missing client_email or private_key')
  }
  // Secrets pasted through a shell often arrive with literal \n.
  sa.private_key = sa.private_key.replace(/\\n/g, '\n')
  return sa
}

// ------------------------------------------------------------------- token
let cached: { token: string; expires: number } | null = null

async function accessToken(): Promise<string> {
  if (cached && cached.expires > Date.now()) return cached.token

  const sa = serviceAccount()
  const now = Math.floor(Date.now() / 1000)
  const claims = {
    iss: sa.client_email,
    scope: SCOPES,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  }
  const signingInput = `${b64urlJson({ alg: 'RS256', typ: 'JWT' })}.${b64urlJson(claims)}`

  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToDer(sa.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(signingInput),
  )
  const assertion = `${signingInput}.${b64url(sig)}`

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok || !body.access_token) {
    throw new Error(`google token ${res.status}: ${JSON.stringify(body).slice(0, 300)}`)
  }

  cached = { token: body.access_token, expires: Date.now() + 50 * 60 * 1000 }
  return cached.token
}

/** Exposed for tests; also lets a redeploy start clean. */
export function resetGoogleToken() {
  cached = null
}

async function googleFetch(url: string, init: RequestInit = {}): Promise<unknown> {
  const token = await accessToken()
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  })
  const text = await res.text()
  if (!res.ok) {
    // 403 here almost always means the file was not shared with the robot.
    const hint = res.status === 403 || res.status === 404
      ? ' — check the calendar/file is shared with the service-account email'
      : ''
    throw new Error(`google ${res.status}${hint}: ${text.slice(0, 300)}`)
  }
  return text ? JSON.parse(text) : {}
}

/** Nicole pastes links, not IDs. Accept either. */
export function extractId(input: string): string {
  const s = String(input).trim()
  const m = s.match(/\/(?:spreadsheets|document)\/d\/([a-zA-Z0-9-_]+)/) ??
    s.match(/[?&]id=([a-zA-Z0-9-_]+)/)
  return m ? m[1] : s
}

const calendarId = () => Deno.env.get('GOOGLE_CALENDAR_ID') || 'primary'

// -------------------------------------------------------------- declarations
const str = (description: string) => ({ type: Type.STRING, description })

export const GOOGLE_TOOLS: FunctionDeclaration[] = [
  {
    name: 'calendar_create',
    description: "Put an event in Nicole's Google Calendar. Use for anything with a date and time.",
    parameters: {
      type: Type.OBJECT,
      required: ['title', 'start_iso', 'end_iso'],
      properties: {
        title: str('Event title as she would recognise it'),
        start_iso: str('Start, ISO-8601 e.g. 2026-09-15T15:00:00'),
        end_iso: str('End, ISO-8601. If she gave no duration, use one hour.'),
        description: str('Optional details'),
      },
    },
  },
  {
    name: 'calendar_list',
    description: 'List calendar events in a time window, earliest first.',
    parameters: {
      type: Type.OBJECT,
      required: ['time_min_iso', 'time_max_iso'],
      properties: {
        time_min_iso: str('Window start, ISO-8601'),
        time_max_iso: str('Window end, ISO-8601'),
      },
    },
  },
  {
    name: 'sheet_append_row',
    description: 'Append one row to a Google Sheet tab.',
    parameters: {
      type: Type.OBJECT,
      required: ['spreadsheet_id', 'tab', 'cells'],
      properties: {
        spreadsheet_id: str('Sheet id or full URL (from memory, kind=id)'),
        tab: str('Tab name, e.g. Competitions'),
        cells: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Cell values, left to right' },
      },
    },
  },
  {
    name: 'sheet_read',
    description: 'Read all rows of a Google Sheet tab. First row is usually the header.',
    parameters: {
      type: Type.OBJECT,
      required: ['spreadsheet_id', 'tab'],
      properties: {
        spreadsheet_id: str('Sheet id or full URL'),
        tab: str('Tab name'),
      },
    },
  },
  {
    name: 'doc_append',
    description: 'Append text to the end of a Google Doc.',
    parameters: {
      type: Type.OBJECT,
      required: ['document_id', 'text'],
      properties: {
        document_id: str('Doc id or full URL'),
        text: str('Text to append. Include your own leading newline if needed.'),
      },
    },
  },
  {
    name: 'telegram_send',
    description:
      "Send a Telegram message to someone other than Nicole, e.g. a student's group chat. Only after Nicole has confirmed the wording.",
    parameters: {
      type: Type.OBJECT,
      required: ['chat_id', 'text'],
      properties: {
        chat_id: str('Target chat id, from memory (kind=id)'),
        text: str('Exactly what to send'),
      },
    },
  },
]

/** sheet_read alone, for the subagents: they may look, never write. */
export const SHEET_READ_TOOL = GOOGLE_TOOLS.find((t) => t.name === 'sheet_read')!

// ---------------------------------------------------------------- executors
export const executeGoogleTool: ToolExecutor = async (name, a) => {
  switch (name) {
    case 'calendar_create': {
      const body = {
        summary: String(a.title ?? ''),
        description: a.description ? String(a.description) : undefined,
        start: { dateTime: String(a.start_iso), timeZone: TZ },
        end: { dateTime: String(a.end_iso), timeZone: TZ },
      }
      const ev = await googleFetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId())}/events`,
        { method: 'POST', body: JSON.stringify(body) },
      ) as Record<string, unknown>
      return { id: ev.id, htmlLink: ev.htmlLink, start: ev.start, summary: ev.summary }
    }

    case 'calendar_list': {
      const qs = new URLSearchParams({
        timeMin: new Date(String(a.time_min_iso)).toISOString(),
        timeMax: new Date(String(a.time_max_iso)).toISOString(),
        singleEvents: 'true',
        orderBy: 'startTime',
        maxResults: '50',
      })
      const res = await googleFetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId())}/events?${qs}`,
      ) as { items?: Record<string, unknown>[] }
      return (res.items ?? []).map((e) => ({
        title: e.summary,
        start: (e.start as Record<string, string>)?.dateTime ?? (e.start as Record<string, string>)?.date,
        end: (e.end as Record<string, string>)?.dateTime ?? (e.end as Record<string, string>)?.date,
      }))
    }

    case 'sheet_append_row': {
      const id = extractId(String(a.spreadsheet_id))
      const range = `${String(a.tab)}!A:A`
      const cells = Array.isArray(a.cells) ? a.cells.map(String) : [String(a.cells ?? '')]
      const res = await googleFetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${encodeURIComponent(range)}:append` +
          `?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
        { method: 'POST', body: JSON.stringify({ values: [cells] }) },
      ) as { updates?: { updatedRange?: string } }
      return { appended: cells, at: res.updates?.updatedRange }
    }

    case 'sheet_read': {
      const id = extractId(String(a.spreadsheet_id))
      const res = await googleFetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${encodeURIComponent(String(a.tab))}`,
      ) as { values?: string[][] }
      return res.values ?? []
    }

    case 'doc_append': {
      const id = extractId(String(a.document_id))
      // endOfSegmentLocation appends to the body without reading the doc first.
      await googleFetch(`https://docs.googleapis.com/v1/documents/${id}:batchUpdate`, {
        method: 'POST',
        body: JSON.stringify({
          requests: [{
            insertText: { endOfSegmentLocation: { segmentId: '' }, text: String(a.text ?? '') },
          }],
        }),
      })
      return { appended: true, chars: String(a.text ?? '').length }
    }

    case 'telegram_send': {
      const { sendMessage } = await import('./telegram.ts')
      await sendMessage(String(a.chat_id), String(a.text ?? ''))
      return { sent: true, to: String(a.chat_id) }
    }

    default:
      return { error: `unknown google tool ${name}` }
  }
}

export const GOOGLE_TOOL_NAMES = new Set(GOOGLE_TOOLS.map((t) => t.name))
