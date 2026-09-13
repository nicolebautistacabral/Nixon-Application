# NIXON — GEMINI BUILD PROMPT (Google-native, free & always-on)

**PASTE THIS WHOLE FILE INTO GEMINI AS THE FIRST MESSAGE.**
Works in Gemini CLI, Google AI Studio Build, or Gemini Code Assist.

---

## Read this part yourself, Nicole, before you paste anything

You already have a working Nixon on Supabase. This is a **different** build of the
same product, on Google's own platform. Use it when one of these is true:

- You want the Google side to stop breaking. Service-account keys, JWT signing,
  calendar sharing and key rotation all disappear in this version.
- You want to run out of Gemini quota less often.
- You want a second copy you can experiment with without touching the live one.

Do **not** throw away the Supabase build to start this. Finish it first. It is one
phase from done, and a half-finished rewrite is worse than either version.

---

## Instructions to you, Gemini

Build **Nixon**, Nicole Bautista Cabral's Telegram personal-assistant agent, in
**7 phases**. After each phase **STOP** and report in ≤10 lines: what you built,
the one command or click I use to test it, what's next. Wait for my `go`.

Rules:

- No planning documents. No README until Phase 7. No refactors of working code.
- Reuse helpers. Two retries maximum on any failing command, then fall back and
  tell me what you fell back to.
- At most ONE question per phase, and only if you are truly blocked.
- Every instruction you give ME must be **numbered, one action per line, naming the
  exact thing to click or paste**. Nicole has ADHD. "Configure the trigger" is a
  failure. "Click Triggers in the left sidebar, then click Add Trigger" is correct.
- Never tell me to hand-edit a file if a command can edit it for me.
- Write the test before you tell me it works. If you could not run something
  yourself, say so plainly instead of implying you verified it.

---

## What Nixon is (concept, non-negotiable)

A Telegram bot that runs Nicole's day across six domain agents and remembers
everything she tells it.

**Daily rhythm (Europe/Lisbon):**

```
07:00  CADENCE lesson (Shakespeare→modern · 5 eloquent word upgrades · 5 PT-PT phrases on today's theme · slang · grammar bite)
        ↓ Nicole replies DONE (she can ask questions first)
       TASK ROUND-UP: open tasks from all 6 agents + today's calendar → "anything to add? / NEXT"
       HELIX 5-layer rabbit hole (a food/habit explained through neuroscience & genetics, Nature-family sources)
        ↓ DONE
       QUIZ: 5 rounds, one per layer, scored /10 → total /50 → logged
       MASTER TO-DO LIST for the day (☐). All day: "done with X" → ☑
12:00  Midday: done vs open per agent + most urgent deadline
18:00  Evening: same + rolls to tomorrow + Ember competition/Canva + Forge build nudges
22:00  Day close: ✅ finished · 🔄 in progress · 🔁 remember tomorrow
22:15  Recap quiz on today's Portuguese + Helix lesson (answer key included)
```

Anything with a date → Google Calendar. Anything she says to remember → memory.
Everything is conversational; no slash-command syntax except `/start`.

**Agents:** NIXON (coordinator) · HELIX (science: malaria thesis, lab logbook,
neuro/genetics lessons, biomedicine classes) · CADENCE (PT-PT + English eloquence) ·
COMPASS (Marketing Head + English tutor of Turkish students) · EMBER (manuscripts,
@chantpaint/@neurogenicole socials, writing competitions, Canva reminders) ·
LEDGER (Gumroad digital products) · FORGE (her tech builds).

---

## Stack (fixed — Google-native, free tier of everything)

```
Runtime:    Google Apps Script (V8), deployed as a Web App
Scheduler:  Apps Script time-driven triggers  (replaces pg_cron)
Storage:    One Google Sheet as the database, one tab per table
Secrets:    PropertiesService (Script Properties)
LLM:        Gemini API via UrlFetchApp
Telegram:   Bot API webhook → the Web App's doPost
Google:     CalendarApp, SpreadsheetApp, DocumentApp — native, no auth code at all
Sources:    Europe PMC REST (free, no key) filtered to Nature-family journals
Dev:        clasp (npm i -g @google/clasp) so the code lives in git, not in a browser tab
```

### Why this stack, specifically

The thing that makes this version worth building is that **Apps Script runs as
Nicole**. `CalendarApp.getDefaultCalendar().createEvent(...)` just works. That one
fact deletes all of the following, every one of which cost real hours on the
Supabase build:

- No service account, no JSON key file, no base64 secret, no key rotation.
- No RS256 JWT signing, no `invalid_grant: Invalid JWT Signature`.
- No sharing a calendar with a robot address, at the right permission level.
- No `GOOGLE_CALENDAR_ID` pointing at the wrong calendar and failing silently.
- No separate cron extension and no hand-pasted SQL carrying a secret.

The cost you are accepting in exchange, and you must tell Nicole these in Phase 1:

- Apps Script has a **6-minute execution limit** per run, and a daily URL-fetch
  quota. Design around it: one Gemini call per pulse where possible.
- A Sheet is a slower and less strict database than Postgres. It is fine at this
  size — one user, hundreds of rows — and wrong at ten thousand rows a day.
- Debugging is weaker than a real test suite. Compensate by building the
  self-tests in Phase 6, not by being careful.

---

## Hard-won constraints — read these before writing any code

These are not theoretical. Every one of them broke the previous build.

**1. Gemini model names retire without warning.**
`gemini-2.5-flash` now returns 404 for new API keys. Never hard-code one model.
Keep an ordered list of candidates, try each in turn, cache the first that answers,
and treat a 404 as "skip this one" rather than an error. Let a Script Property
override the list.

**2. The free tier limit is per DAY, per model, and it is small.**
Google returned `limit: 20` per day on `gemini-3.6-flash`. A single five-request
lesson therefore costs a quarter of the day's budget. Two consequences you must
build in from the start, not later:

- **Distinguish the two kinds of 429.** A per-minute burst should be waited out,
  honouring the `retryDelay` in the error body. A spent daily quota should make you
  mark that model used up and fall through to the next candidate. Retrying the same
  model on a daily cap is pure waste.
- **Budget requests like money.** Never let the model spend a call asking for
  something you can read yourself.

**3. Prefetch context instead of letting the model fetch it.**
Read memory and today's state from the Sheet before the turn starts and paste them
into the message header. This takes an ordinary message from three Gemini requests
down to one. It is the single biggest saving available.

**4. Cap the output tokens and report `finishReason`.**
A long lesson plus thinking tokens can return an empty candidate. Set
`maxOutputTokens` generously, and when a response has no text and no function call,
put the `finishReason` in the error so the log says why.

**5. Give every scheduled slot a window, not a minute.**
Triggers run late. A pulse due at 07:00 should accept 07:00 to 07:09.

**6. Make repeated delivery harmless.**
A retried trigger must not send the morning lesson twice. Record which pulse was
sent on which date and skip a repeat, with a `force` override for testing.

**7. Decide the schedule in code, from Lisbon time.**
Do not encode 07:00 in the trigger. Run hourly and let the function decide. This
keeps the timetable correct across the October clock change with no edits.

**8. Build a self-test before you need one.**
When setup breaks, the error rarely names the cause. Ship a diagnostic that checks
each layer in order and stops at the first failure, naming the exact remedy.

---

## PHASE 1 — Apps Script project, the Sheet database, and secrets

**Tell me to do (numbered):** create a new Google Sheet named `Nixon DB` → note its
URL → Extensions → Apps Script → name the project `Nixon` → get a Gemini key at
aistudio.google.com/apikey → get a Telegram bot token from @BotFather (/newbot).
Also: `npm i -g @google/clasp`, then `clasp login`, then `clasp clone <script id>`
so the code lives in this repo.

**You do:** create the tabs, each with a header row, matching this shape exactly:

| tab | columns |
| --- | --- |
| `tasks` | task_id, agent, task, deadline, status, priority, notes, created_at, updated_at |
| `memory` | key, value, kind, updated_at |
| `daily_state` | date, phase, cadence_day, cadence_theme, helix_topic, quiz_round, quiz_scores, notes, updated_at |
| `learning` | id, date, agent, topic, content, created_at |
| `messages` | id, chat_id, role, content, created_at |
| `settings` | key, value |

Constraints to enforce in code, since a Sheet will not enforce them for you:
`agent` ∈ nixon, helix, cadence, compass, ember, ledger, forge · `status` ∈ open,
in_progress, done · `kind` ∈ instruction, id, preference, fact · `phase` ∈
cadence_lesson, cadence_done, helix_lesson, helix_quiz, open, closed.

Write `Db.gs` with typed helpers over these tabs: `readTasks`, `upsertTask`,
`readMemory`, `upsertMemory`, `readState`, `upsertState`, `appendLearning`,
`readLearning`, `loadHistory`, `saveTurn`, `getSetting`, `setSetting`. Read a whole
tab once per call with `getDataRange().getValues()` and work in memory; never read
cell by cell.

Store `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `GEMINI_API_KEY` in Script
Properties, and tell me the exact clicks to add them.

**STOP.**

---

## PHASE 2 — Telegram webhook, echo test

`Telegram.gs`: `sendMessage(chatId, text)` — plain text, `disable_web_page_preview`,
split at 4000 characters on the last newline.

`Main.gs`: `doPost(e)` parses the update. On `/start`, save `chat.id` into
`settings.owner_chat_id` and send the help card below. On any other text, echo it
back for now. Ignore any chat_id that is not the owner once the owner is set.
Always return `ContentService` output quickly.

Apps Script Web Apps cannot read custom request headers, so Telegram's secret-token
header is unavailable. Put the shared secret in the URL instead
(`?s=<TELEGRAM_WEBHOOK_SECRET>`), compare it in `doPost`, and reject a mismatch.
Say this trade-off out loud when you report the phase.

Deploy: Deploy → New deployment → Web app → Execute as **Me** → Who has access
**Anyone**. Give me the numbered clicks and then the exact `setWebhook` URL with my
values filled in.

Help card text:

```
👋 Hi Nicole — Nixon here. Just talk to me.
• "Remember: my lab logbook sheet is <link>"
• "Add: submit WP2 report by Friday 17:00"
• "Done with the Portuguese" / "Finished the Elif evaluation"
• "What's open for Ember?"
Daily: 07:00 lesson → DONE → round-up → Helix → DONE → quiz → to-do · 12:00 · 18:00 · 22:00 close · 22:15 recap
```

**Test:** I send `/start` then `hello` → help card, then echo. **STOP.**

---

## PHASE 3 — Nixon core (Gemini tool loop + memory + state machine)

`Gemini.gs`: `runAgent({system, history, userText, tools, execute, role, maxSteps})`
calling `generateContent` over `UrlFetchApp` with `functionDeclarations`. Loop:
call → if the response has function calls, execute each and feed back
`functionResponse` parts → repeat until text. Temperature 0.4.

Apply constraints 1, 2 and 4 above. Two roles: `coordinator` for Nixon's own turns,
which should prefer lite models with larger daily allowances, and `author` for the
subagents, which should get the more capable model because the writing is the
product.

`Tools.gs`: `read_tasks` · `upsert_task` · `read_memory` · `upsert_memory` ·
`read_state` · `upsert_state` · `append_learning` · `read_learning` ·
`delegate({agent, request})` (stub until Phase 4) · `think({thought})`.

`Nixon.gs`: one `runNixon(chat, kind, text)` used by both the webhook and the
scheduler, so they cannot drift apart. Build the header per constraint 3:

```
[<kind> | <Lisbon datetime> | today=<YYYY-MM-DD> (<Weekday>)]
MEMORY:
<key> [<kind>] = <value>          (one per line, or "(empty)")
TODAY'S STATE (<date>):
<the row as JSON, or "(no row yet)">
---
```

Load the last 30 rows of `messages` as history. Save both turns. On any thrown
error send "Something broke on my side — try again in a minute." and log the detail.

**The NIXON system prompt is in `supabase/functions/_shared/agents.ts` in this
repo, exported as `NIXON_SYSTEM`. Copy it verbatim.** Append an addendum stating
that memory and state are already in the header, that `read_memory` and
`read_state` must not be called again, and that this overrides RULE A.

**Test:** "Remember: I always want confirmation before you send anything to a
student" → memory row. "Add: WP2 report by Friday 17:00" → tasks row. "Done with
the WP2 report" → ✅. **STOP.**

---

## PHASE 4 — The six subagents + lesson modes

`delegate(agent, request)` = a nested `runAgent` with that agent's system prompt,
no history, role `author`. Helix additionally gets `nature_search`.

**All six system prompts already exist in
`supabase/functions/_shared/agents.ts`: `CADENCE_SYSTEM`, `HELIX_SYSTEM`,
`COMPASS_SYSTEM`, `EMBER_SYSTEM`, `LEDGER_SYSTEM`, `FORGE_SYSTEM`. Copy them
verbatim. Do not rewrite them.**

`nature_search({query})`: GET
`https://www.ebi.ac.uk/europepmc/webservices/rest/search` with
`query=(<q>) AND (JOURNAL:"Nature" OR JOURNAL:"Nature Neuroscience" OR
JOURNAL:"Nature Genetics" OR JOURNAL:"Nature Reviews Neuroscience" OR
JOURNAL:"Nature Metabolism" OR JOURNAL:"Nature Communications")`,
`format=json`, `pageSize=6`, `resultType=lite`, `sort=CITED desc`. Return
`[{title, journal, year, doi}]` from `resultList.result`, dropping rows without a
DOI. **Note the `/webservices/` path segment; without it the endpoint 404s.**

Return an error object rather than throwing when the search fails, so an outage
costs the citations and not the whole lesson. Give it a timeout.

**Test:** "give me today's Portuguese lesson" → full Cadence structure. "Teach me
about coffee and the brain" → 5 layers + real DOIs I can click. **STOP.**

---

## PHASE 5 — Calendar, Sheets and Docs (the easy part, here)

No credentials. No sharing. Add these tools straight onto the built-in services:

- `calendar_create({title, start_iso, end_iso, description})` →
  `CalendarApp.getDefaultCalendar().createEvent(...)`
- `calendar_list({time_min_iso, time_max_iso})` → `getEvents(start, end)`
- `sheet_append_row({spreadsheet_id, tab, cells})` → `SpreadsheetApp.openById(...)`
- `sheet_read({spreadsheet_id, tab})`
- `doc_append({document_id, text})` → `DocumentApp.openById(...).getBody().appendParagraph(...)`
- `telegram_send({chat_id, text})` for student group chats

Two things to get right:

1. Accept a pasted Google URL anywhere an id is expected and extract the id.
   Nicole will paste links, not ids.
2. Nixon performs every write. Subagents get `sheet_read` and nothing else.

The first run will show an authorisation dialog. Give me the exact numbered clicks,
including the "Advanced → Go to Nixon (unsafe)" path, which looks alarming and is
the normal route for a personal script you wrote yourself.

**Test:** "Add: dentist Tuesday 15:00" → the event is in my calendar within
seconds. **STOP.**

---

## PHASE 6 — Scheduled pulses + self-tests

`Pulse.gs`: `pulse()` reads Lisbon time and maps it to a mode —
07:00 `pulse_0700_cadence` · 12:00 `pulse_1200_midday` · 18:00 `pulse_1800_evening`
· 22:00 `pulse_2200_close` · 22:15 `pulse_2215_recap` · anything else returns
without spending a request. Apply constraints 5, 6 and 7.

Create **two** time-driven triggers programmatically in a `setupTriggers()`
function I run once: one hourly, one hourly offset to the quarter hour. Do not
make me click through the trigger UI five times.

Then `selfTest()`, per constraint 8, checking in order and stopping at the first
failure: Script Properties present · the Sheet reachable and every tab found ·
Gemini answering, naming which model won · Calendar readable and writable ·
Telegram reachable. Each failure line must name the remedy, not just the error.

**Test:** give me a one-line function name to run from the editor that fires the
morning flow immediately. **STOP.**

---

## PHASE 7 — Hardening + README

1. Ignore duplicate Telegram updates by `update_id`.
2. Trim `messages` to the last 200 rows per chat during the 22:00 pulse.
3. Use a `LockService` lock around the pulse so two triggers cannot overlap.
4. `README.md`: what it is in three lines · setup as numbered steps · the
   "Remember: … is <link>" messages I send once to register my files · the daily
   rhythm block · how to force a pulse · what to do when the self-test fails.
5. Final end-to-end: `/start` → forced morning pulse → DONE → round-up → NEXT →
   Helix → DONE → five quiz answers → to-do list.

**STOP.** Report ✅ working · ⚠️ fallbacks · anything you could not verify yourself
· cost (should be €0).

---

## Boundaries

- Never invent a citation. Helix cites only what `nature_search` returned.
- Never send anything to a student without Nicole confirming the wording first.
- Ember reviews manuscripts and never ghostwrites.
- Ledger never invents urgency, scarcity, testimonials, or numbers.
- Plain text only in Telegram: no markdown tables, no `###`, no `**`.

Go. Phase 1 first. STOP after Phase 1.
