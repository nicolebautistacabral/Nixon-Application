# Nixon

A Telegram assistant that runs Nicole Bautista Cabral's day across six domain
agents and remembers everything she tells it. It teaches European Portuguese
every morning, quizzes her on neuroscience, tracks every commitment, and writes
anything with a date into Google Calendar.

It runs on Supabase Edge Functions with Gemini, costs nothing, and is always on.

---

## Daily rhythm (Europe/Lisbon)

```
07:00  Portuguese lesson (Shakespeare · 5 eloquent upgrades · 5 PT-PT phrases · slang · grammar)
        ↓ reply DONE
       Task round-up across all six agents + today's calendar
       Helix 5-layer rabbit hole, with real Nature-family sources
        ↓ reply DONE
       Quiz: 5 rounds, one per layer, scored /50
       Master to-do list. All day: "done with X" ticks it off.
12:00  Midday: done vs open per agent, most urgent deadline
18:00  Evening: same, plus what rolls to tomorrow
22:00  Day close: finished · in progress · remember tomorrow
22:15  Recap quiz on today's Portuguese and Helix lesson
```

Just talk to it. There is no command syntax except `/start`.

---

## The agents

| Agent | Owns |
| --- | --- |
| **Nixon** | Coordinator. Talks to Nicole, does every write, delegates the rest. |
| **Helix** | Malaria thesis, lab logbook, neuro/genetics lessons, biomedicine classes |
| **Cadence** | European Portuguese and English eloquence |
| **Compass** | Marketing, and English tutoring of Turkish students |
| **Ember** | Manuscripts, socials, writing competitions, Canva |
| **Ledger** | Gumroad digital products |
| **Forge** | Her tech builds |

Subagents only read. Nixon performs every write, so there is one place where
anything can change.

---

## Setup

Done once, in this order. Steps 1 to 4 are the minimum for a working bot.

### 1. Supabase

1. Create a free project at https://supabase.com and name it `nixon`.
2. Copy the **Reference ID** from Project Settings → General.
3. In this folder run `npx supabase login`.
4. Run `npx supabase link --project-ref <ref>` and enter your database password.
5. Run `npx supabase db push` to create the tables.

### 2. Secrets

Get a bot token from [@BotFather](https://t.me/BotFather) via `/newbot`, and a
Gemini key from https://aistudio.google.com/apikey. Then, in PowerShell:

```powershell
$wh = -join ((1..32) | ForEach-Object { '{0:x}' -f (Get-Random -Maximum 16) })
$cr = -join ((1..32) | ForEach-Object { '{0:x}' -f (Get-Random -Maximum 16) })
npx supabase secrets set TELEGRAM_BOT_TOKEN=<token> GEMINI_API_KEY=<key> TELEGRAM_WEBHOOK_SECRET=$wh NIXON_CRON_SECRET=$cr
```

Keep `$wh` and `$cr`. You need them below.

### 3. Deploy and connect Telegram

```powershell
npx supabase functions deploy telegram --no-verify-jwt
npx supabase functions deploy pulse --no-verify-jwt
```

Then open this URL once in a browser, with your values filled in:

```
https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<ref>.supabase.co/functions/v1/telegram&secret_token=<$wh>&drop_pending_updates=true
```

Send `/start` to the bot. The first person to do so becomes the owner; everyone
else is ignored from then on.

### 4. Google Calendar, Sheets and Docs

1. At https://console.cloud.google.com create a project and enable the **Google
   Calendar API**, **Google Sheets API** and **Google Docs API**.
2. Create a service account, then Keys → Add key → JSON. Save it as `key.json`.
   It is gitignored.
3. Copy the service account email, ending `.iam.gserviceaccount.com`.
4. In Google Calendar → Settings and sharing → share your calendar with that
   email at **Make changes to events**.
5. Share any Sheet or Doc Nixon should touch with the same email, as Editor.
6. Store it:

```powershell
$sa = [Convert]::ToBase64String([IO.File]::ReadAllBytes((Resolve-Path "key.json").Path))
npx supabase secrets set GOOGLE_SA_JSON=$sa GOOGLE_CALENDAR_ID=<your gmail address>
npx supabase functions deploy telegram --no-verify-jwt
```

`GOOGLE_CALENDAR_ID` must be **your** address, not the service account's. Setting
it to the robot's address puts every event on a calendar you cannot see.

Then check it, which costs no model quota:

```powershell
curl.exe "https://<ref>.supabase.co/functions/v1/pulse?selftest=google" -H "x-nixon-secret: $cr"
```

It checks each layer in order and names the exact remedy for whatever is wrong.

### 5. Schedule the daily pulses

```powershell
(Get-Content supabase\migrations\0002_cron.sql -Raw).Replace('PUT_YOUR_CRON_SECRET_HERE', $cr) | Set-Content cron-ready.sql
notepad cron-ready.sql
```

Copy all of it into Supabase → SQL Editor → Run. Confirm with:

```sql
select jobname, schedule, active from cron.job;
```

`cron-ready.sql` contains your secret and is gitignored.

---

## Register your files

Send these once, in Telegram, in your own words. Nixon stores them and uses them
from then on.

```
Remember: my lab logbook sheet is <link>
Remember: my biomedicine classes sheet is <link>
Remember: my competitions sheet is <link>
Remember: my manuscripts doc is <link>
Remember: my social performance sheet is <link>
Remember: my content planning sheet is <link>
Remember: my student matrix sheet is <link>
Remember: my lesson planning doc is <link>
Remember: my sales sheet is <link>
Remember: I always want confirmation before you send anything to a student
```

---

## Forcing a pulse

To run a scheduled moment now rather than waiting for it:

```powershell
curl.exe -X POST "https://<ref>.supabase.co/functions/v1/pulse?force=pulse_0700_cadence" -H "x-nixon-secret: $cr"
```

Modes: `pulse_0700_cadence` · `pulse_1200_midday` · `pulse_1800_evening` ·
`pulse_2200_close` · `pulse_2215_recap`.

`force` also overrides the once-a-day guard, so you can re-run the morning flow
while testing.

---

## Troubleshooting

Logs are in Supabase → Edge Functions → the function → **Logs**.

| Symptom | Cause and fix |
| --- | --- |
| No reply at all | Check the webhook: open `https://api.telegram.org/bot<TOKEN>/getWebhookInfo`. `last_error_message` names the problem. |
| "Something broke on my side" | Read the logs. The error line names the cause. |
| `Could not find the table` | `npx supabase db push` did not run. |
| `RESOURCE_EXHAUSTED` / quota | The free Gemini tier is capped **per day, per model** (as low as 20). Nixon falls through to another model automatically; if all are spent, it resets at midnight Pacific, which is 08:00 Lisbon. |
| Calendar events not appearing | Run the self-test above. Usually the calendar is not shared with the service account, or `GOOGLE_CALENDAR_ID` is wrong. |
| `Invalid JWT Signature` | The service-account key was deleted or replaced. Download a new JSON key and set `GOOGLE_SA_JSON` again. |
| `google 403` on a sheet | That sheet is not shared with the service account email. |
| Pulses not firing | `select jobname, active from cron.job;` — if empty, the Phase 5 SQL was never run. |
| Duplicate messages | Should be impossible; `processed_updates` blocks repeats. If it happens, check migration `0003` was applied. |

---

## Working on the code

```
supabase/
├── migrations/            0001 schema · 0002 cron (paste by hand) · 0003 dedupe
└── functions/
    ├── _shared/
    │   ├── agents.ts      all seven system prompts
    │   ├── db.ts          Postgres helpers, history, housekeeping
    │   ├── gemini.ts      the tool-calling loop, model fallback, quota handling
    │   ├── google.ts      service-account JWT, Calendar/Sheets/Docs
    │   ├── nature.ts      Europe PMC search, Nature family only
    │   ├── nixon.ts       the one place Nixon runs
    │   ├── subagents.ts   the six specialists
    │   ├── telegram.ts    sendMessage with chunking
    │   ├── time.ts        Lisbon date and time
    │   └── tools.ts       tool declarations and executors
    ├── telegram/          the webhook
    ├── pulse/             the cron target and the self-test
    └── _tests/            200 assertions; run with `npm test`
```

`npm test` needs Deno. Everything is stubbed, so it hits no network and spends no
quota.

Two design notes worth knowing before changing anything:

- **Requests are budgeted.** Memory and today's state are read from Postgres and
  pasted into the prompt header rather than fetched by the model. That takes an
  ordinary message from three Gemini requests to one. Do not add tool round trips
  casually.
- **The schedule lives in code, not in cron.** Two hourly jobs call the pulse
  function, which reads Lisbon time and decides what is due. This stays correct
  across daylight saving with no changes.

---

## Cost

Nothing. Supabase free tier, Gemini free tier, Telegram, and Europe PMC, which
needs no key.
