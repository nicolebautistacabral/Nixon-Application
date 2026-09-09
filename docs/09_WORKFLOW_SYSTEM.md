# §09 — THE WORKFLOW SYSTEM
### n8n only. Calendar as the spine. No interface.

**This supersedes `08` as the live plan.** Docs `02` (design direction) and `03` (screen-by-screen) are dormant — the dashboard is deferred, not cancelled, so nothing here blocks adding it later.

Scope confirmed: Calendar is **both trigger and output**. Postgres is truth, a Google Sheet is the readable mirror. Telegram is the only conversation surface.

---

## 1. THE SHAPE

```
  TELEGRAM ──► n8n 2.x ──► POSTGRES   (truth: tasks, memory, messages)
                  │
                  ├──────► GOOGLE CALENDAR   "Nixon" sub-calendar only
                  │                          plan AND record
                  └──────► GOOGLE SHEET      readable board, mirrored
```

**Calendar is the spine.** A task with a date becomes an event. State changes update that event. Completed events stay in the past, so your calendar becomes the record of what actually happened, not just what was planned. The Calendar Trigger nudges before an event and asks *"did this get done?"* after it — which is how completion gets recorded without you having to remember to report it.

---

## 2. CALENDAR MAPPING

**A dedicated `Nixon` sub-calendar. The system never writes to your personal or university calendars.** This is the one place a bug could damage something you depend on, so it is a hard boundary, not a convention.

| Task field | Calendar field |
|---|---|
| `title` | `summary`, prefixed with the state glyph |
| `agent_id` | `colorId` — one colour per agent, seeded in `db/schema.sql` |
| `due_at` | event start |
| `id` | written into `description` as `nixon:<uuid>` — how the trigger finds its way back |
| `state` | the glyph, updated in place |

```
 ○  todo          ◐  in_progress      ⏸  blocked
 ✓  done          ✕  cancelled
```

So `◐ Helix — Methods section draft` on Thursday at 14:00. When it finishes it becomes `✓ Helix — Methods section draft`, still sitting on Thursday. Scroll back a month and you can see what actually happened.

**Trigger events used:** `eventStarted` → a nudge. `eventEnded` → *"Did this get done?"* with inline **Yes / Not yet / Cancel** buttons that write state straight back.

**Caveat:** the Google Calendar Trigger **polls** rather than using webhooks. Poll every minute for time-sensitive work. That is 1,440 API calls a day per trigger workflow — well inside Google's quota, but it also means the trigger only fires while your machine is awake.

---

## 3. WORKFLOW INVENTORY — 25

Naming is `layer.name`. Agent workflows are **called**, never triggered directly.

### Entry
**`nixon.telegram-in`** — Telegram Trigger
```
Telegram Trigger
  └─ IF chat.id == $env.NIXON_TELEGRAM_CHAT_ID      ← reject everything else, first
      └─ Postgres: INSERT INTO messages             ← capture verbatim, before anything
          └─ Switch on command
              ├─ /status /today /board  → svc.digest → svc.notify
              ├─ /pause /resume         → users.paused
              ├─ /log <text>            → agent.helix
              └─ free text              → AI classifier
                    ├─ task?    → svc.board (create) → svc.calendar
                    ├─ rule?    → svc.memory (write) → confirm inline, with undo
                    └─ question → route to agent
```
The chat-ID check is the **first** node after the trigger. Anyone who finds the bot could otherwise command your agents.

### Agents — 6
`agent.helix` `agent.ember` `agent.compass` `agent.ledger` `agent.cadence` `agent.forge`

Each: one AI Agent node, Claude as the model, its own system prompt, its own tools, Postgres chat memory keyed by thread.

```
Execute Sub-workflow Trigger
  └─ svc.memory (fetch active standing instructions for this agent)
      └─ AI Agent  ── system prompt = base + standing instructions
      │              ── tools: Sheets, Docs, Drive, HTTP, svc.board, svc.approve
      └─ Code: boundary checks        ← never-invent, health-advice limit,
          └─ svc.board (update)         European-not-Brazilian, student isolation
```

The boundary checks are a **Code node on the delivery path, not prompt text**. A prompt is guidance; these must not fail.

### Shared services — 6
The only workflows that write. Everything else calls these.

| Workflow | Does |
|---|---|
| `svc.board` | create / start / block / complete / cancel a task. **Single writer to `tasks`.** Calls `svc.calendar` on every state change. |
| `svc.calendar` | project a task onto the Nixon calendar; keep glyph and colour in sync |
| `svc.memory` | fetch active standing instructions for an agent; write new ones |
| `svc.notify` | Telegram send, quiet-hours check, idempotency key, log |
| `svc.approve` | the Wait gate for irreversible actions |
| `svc.digest` | **builds the status roll-up.** Called by every pulse. |

**`svc.approve`** — the autonomy protocol's confirm gate:
```
Execute Sub-workflow Trigger  (task_id, what, target)
  └─ svc.board: state → blocked, store $execution.resumeUrl
      └─ Telegram: "Send and Wait for Approval"
          │   Resume: On Webhook Call
          │   Limit:  48 hours          ← REQUIRED. Unbounded waits become
          │                                zombie executions forever.
          ├─ approved → svc.board: in_progress → caller continues
          ├─ rejected → svc.board: cancelled
          └─ timeout  → svc.board: back to todo, note the lapse,
                        next pulse mentions it
```

### Schedules — 10
Each is thin: trigger, query, call a service. Rarely more than five nodes.

`cron.pulse-morning` 08:00 · `cron.pulse-midday` 12:00 · `cron.pulse-evening` 18:00 · `cron.pulse-final` **21:30**
`cron.cadence-lesson` 07:00 · `cron.cadence-quiz` 20:00 · `cron.helix-concept` daily
`cron.deadlines` daily (competitions at 7/3/1 days) · `cron.stale` daily (aging nudge) · `cron.rollup` weekly
`cron.mirror` — Postgres → the Sheet board

Final Sync is **21:30, not 22:00** — at 22:00 it lands exactly on the quiet-hours boundary and gets queued to the following morning, arriving on top of the Morning Brief.

### Calendar — 1
`cal.trigger` — Google Calendar Trigger on the Nixon calendar, `eventStarted` and `eventEnded`.

---

## 4. THE DIGEST — WHAT YOU ACTUALLY ASKED FOR

`svc.digest` takes a scope and assembles from three sources: `tasks`, `memory_items`, and the Nixon calendar.

```
🌅 Morning Brief — Tue 9 Sep

TODAY
  09:30  Lab — WP2 plate 15
  14:00  Elif — trial class
  ⚠ Jakarta Poetry Prize — 3 days left

IN PROGRESS (3)
  ◐ Helix    Methods section draft          2d
  ◐ Ember    Competition sweep              1d
  ⏸ Compass  Elif evaluation — waiting on you

DONE SINCE YESTERDAY (4)
  ✓ Helix    WP2 plate 14 logged — 6 rows
  ✓ Cadence  Lesson 47, quiz 8/10

NOT STARTED (7)  oldest first
  ○ Ledger   Notion template pricing        you asked 6d ago
```

**Per-scope slices:** morning = today + not-started · midday = in-progress + blocked · evening = done today · final = tomorrow + still-open.

**"From the memory of what I instructed" is served two ways:**

1. **Provenance on every line.** Every task carries `source_message_id` back to the sentence you typed, so the digest can say *"you asked 6d ago"*. The join is verified working:
   ```sql
   SELECT a.name, t.state, t.title, left(m.body,30) AS you_said
   FROM tasks t
   JOIN agents a ON a.id = t.agent_id
   LEFT JOIN messages m ON m.id = t.source_message_id
   WHERE t.state IN ('todo','in_progress','blocked');
   ```

2. **A weekly standing-rules digest** in `cron.rollup`, so no rule silently governs your work:
   ```
   YOUR STANDING RULES (12 active)
     Ember   · only zero-fee competitions, deadline before 2026-12-31
     Global  · always ask before sending anything
   ```

---

## 5. SCHEMA

`db/schema.sql` — applied and behaviour-tested against Postgres 16. Six tables: `users` `agents` `messages` `memory_items` `tasks` `task_outputs` `notification_log`.

Three guarantees are enforced by the database rather than by discipline, and each was verified by attempting to violate it:

- **`messages` is append-only.** A trigger raises on UPDATE and DELETE. If classification is wrong six months from now, the original sentence is still there.
- **Task states are constrained.** `almost_done` is rejected at insert; no typo can create a state the digest cannot count.
- **Notifications are idempotent.** A unique index on `(user_id, idempotency_key)` means a restart or a double-fire cannot send two Morning Briefs.

**On row-level security:** §6.4 existed to stop an application bug leaking data between users. With one user and n8n connecting as a single trusted identity, it guards nothing real here. `user_id` stays on every table — it costs nothing and keeps the dashboard deferrable — but Phase 1 does not spend time on RLS policies. Security has relocated, not vanished.

---

## 6. SECURITY, RELOCATED

The §6 checklist was written for an internet-facing app. What replaces it:

- **`N8N_ENCRYPTION_KEY` set explicitly and backed up offline.** Every stored credential is encrypted with it. Lose it and Google, Telegram, Gumroad, Zoho, and Anthropic all become unrecoverable.
- **Telegram chat-ID allowlist**, first node after every Telegram Trigger. This was §6.10 and it survives intact.
- **Nothing bound to `0.0.0.0`.** Both ports are `127.0.0.1` only in `docker-compose.yml`.
- **The dedicated Nixon sub-calendar.** Non-negotiable.
- **Boundary rules in Code nodes**, not prompts.
- **n8n 2.x pinned by exact patch tag.** Wait-in-sub-workflow deadlocked the parent before 2.0.
- **Every Wait node carries a 48h limit** with a fallback path.

---

## 7. BUILD ORDER

| Phase | Days | Gate |
|---|---|---|
| **1 Foundation** | 1 | A Telegram message creates a task row, a Sheet line, and a calendar event. A message from any other chat ID is rejected. |
| **2 Spine** | 2 | The six `svc.*`, `cron.mirror`, `cal.trigger`. Completing an event via the post-event button updates Postgres, Sheet, and glyph. |
| **3 Pulses** | 1 | `svc.digest` + four pulses + `cron.stale` + `cron.deadlines`. Counts checked by hand against the database. |
| **4 Agents** | 3–4 | Helix → Cadence → Compass → Ember → Ledger → Forge. Each tested alone via Execute before wiring to Telegram. |
| **5 Harden** | 1 | Wait timeouts, error workflows, quiet hours, export to `n8n/workflows/`. |

**Helix first** because it carries the most daily value. **Cadence second** because it is the most mechanical — a clean proof that the schedule loop works end to end before the messier agents.

---

## 8. STANDING CAVEAT

On local hosting, every Schedule Trigger and the Calendar Trigger's polling run **only while your machine is awake**. Nothing in this architecture changes when it moves to an always-on host, so that decision can wait until the system has earned it.
