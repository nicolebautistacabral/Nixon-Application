# §10 — DEPLOY RUNBOOK (batch 1)
### Five workflows. Follow in order — later steps depend on IDs from earlier ones.

**What you are deploying:** the spine. When it works, a Telegram message becomes a task row, a calendar event, and a Sheet line, and you get a confirmation back.

**Time:** about 45 minutes, most of it credential setup.

---

## BEFORE YOU START

### 1. Supabase — the database

1. Create a project at supabase.com (free tier is fine).
2. **SQL Editor** → paste all of `db/schema.sql` → Run. It creates seven tables and seeds the seven agents.
3. Seed your user row — replace both values:
   ```sql
   INSERT INTO users (email, telegram_chat_id)
   VALUES ('nicolebautistacabral@gmail.com', 'YOUR_TELEGRAM_CHAT_ID');
   ```
   Get your chat ID by messaging [@userinfobot](https://t.me/userinfobot) on Telegram.
4. **Settings → Database** → copy the connection details. You need host, port, database, user, password.

### 2. A NEW Google Calendar — not an existing one

**This matters more than anything else in this runbook.** The system writes and deletes events. It must never touch your personal or university calendar.

Google Calendar → **Other calendars → + → Create new calendar** → name it `Nixon` → Create.
Then **Settings for my calendars → Nixon → Integrate calendar** → copy the **Calendar ID**.

### 3. A Google Sheet for the board

New sheet, name a tab **`Board`**, and put this header row in row 1, exactly:

```
task_id | agent | title | state | thread | created | due | completed | you_said
```

Copy the Sheet ID from the URL — the long string between `/d/` and `/edit`.

### 4. n8n Cloud credentials

**Settings → Credentials**, create five:

| Type | Name it | Notes |
|---|---|---|
| Telegram | `Nixon Bot` | Token from [@BotFather](https://t.me/BotFather) |
| Postgres | `Nixon Supabase` | From step 1.4. **SSL: enable.** |
| Google Calendar OAuth2 | `Nixon Calendar` | Grant calendar access |
| Google Sheets OAuth2 | `Nixon Sheets` | Grant sheets access |
| Anthropic | `Nixon Claude` | Not used in batch 1 — set up now for batch 4 |

### 5. n8n variables

**Settings → Variables** (Cloud feature), add three:

| Name | Value |
|---|---|
| `NIXON_TELEGRAM_CHAT_ID` | your chat ID from step 1.3 |
| `NIXON_CALENDAR_ID` | the Nixon calendar ID from step 2 |
| `NIXON_BOARD_SHEET_ID` | the Sheet ID from step 3 |

### 6. Confirm your n8n version

**Help → About.** It must report **2.x**. Batch 2's approval gate depends on a fix that landed in 2.0 — Wait nodes inside sub-workflows used to deadlock the parent execution permanently. Cloud is managed and should be current, but check.

---

## IMPORT — IN THIS ORDER

Dependency order matters: `svc.board` calls the two below it, and `nixon.telegram-in` calls `svc.board`.

```
  1. svc.mirror
  2. svc.calendar
  3. svc.notify
  4. svc.board          ← then repoint 2 nodes
  5. nixon.telegram-in  ← then repoint 1 node
```

For each: **Workflows → ... menu → Import from File** → pick the `.json` from `n8n/workflows/`.

### After each import — attach credentials

Every Postgres, Telegram, Google Calendar, and Google Sheets node shows a red credential warning. Open each and pick the credential you made in step 4. The JSON contains placeholders like `REPLACE_POSTGRES_CRED`, which is the marker that one still needs attaching.

### After importing `svc.board` — repoint two nodes

Open it. Two **Execute Workflow** nodes carry placeholder IDs:

- **Sync Calendar** → set Workflow to your imported `svc.calendar`
- **Mirror To Sheet** → set Workflow to your imported `svc.mirror`

### After importing `nixon.telegram-in` — repoint one node

- **Create Task** → set Workflow to your imported `svc.board`

### Activate

Only `nixon.telegram-in` gets activated — it holds the Telegram trigger. The three `svc.*` workflows stay inactive; they run when called. `svc.notify` is unused in batch 1 and lands in batch 2.

---

## ACCEPTANCE TEST

Run all five. Do not skip 1 or 5.

**1. The allowlist rejects strangers.**
From a **different** Telegram account, message the bot. Nothing should happen — no reply, no database row. Check `SELECT count(*) FROM messages;` — unchanged. *If this fails, stop and fix it before anything else. Anyone who finds your bot could otherwise command your agents.*

**2. A message becomes a task.**
From your own account, send: `draft the Methods section for WP2`

Expect within a few seconds:
- Telegram replies `✓ Noted — helix: draft the Methods section for WP2`
- `SELECT * FROM messages ORDER BY created_at DESC LIMIT 1;` → your exact text
- `SELECT * FROM tasks ORDER BY created_at DESC LIMIT 1;` → state `todo`, agent Helix
- Your **Nixon** calendar shows `○ Helix — draft the Methods section for WP2`
- The Sheet has a new row, with your original sentence in `you_said`

**3. A question does not become a task.**
Send: `how many competitions did we find?` — it should be captured in `messages` but create **no** task. The batch 1 classifier is deliberately rule-based; the Claude one arrives in batch 4.

**4. Completing updates everything.**
In n8n, open `svc.board` → Execute Workflow with input:
```json
{ "action": "complete", "task_id": "<the uuid from step 2>" }
```
The calendar glyph flips `○` → `✓`, the Sheet row's state changes, `completed_at` is set.

**5. Your real calendars are untouched.**
Open Google Calendar and confirm nothing was written to your personal or university calendars. Only `Nixon` has events.

---

## WHAT I VERIFIED, AND WHAT I COULD NOT

**Verified here, mechanically:**
- All twelve node type identifiers and their version ceilings read from the n8n source, not recalled.
- JSON parses; every connection points at a node that exists; no unreachable nodes; every `$('Node')` reference resolves.
- All four Code nodes pass `node --check`.
- All thirteen SQL statements ran against a live Postgres 16 with this exact schema — **zero errors**.
- The full data path executed: message → task → calendar payload → Sheet rows → completion.
- The quiet-hours `queued_until` arithmetic returns a future timestamp even when run after the boundary — the defect in the original push-notification guide (`docs/05` A-6), fixed and proven.

**Not verified, because it needs a running n8n:**
- Parameter shapes for the Google Calendar, Google Sheets, and Telegram nodes. These are the likeliest thing to need a small fix on import.
- Whether `typeVersion` values match what your Cloud instance expects. n8n usually migrates upward silently.
- The `$vars` variable syntax against your actual Cloud plan.

This is exactly why batch 1 is five files and not twenty-five. **If something errors on import, send me the message and I will fix it** — then batches 2 through 5 inherit the correction.

---

## NEXT

Once batch 1 passes, batch 2 is `svc.digest`, `svc.approve`, `cal.trigger`, and the four daily pulses — the reminders that tell you what is done, in progress, and not yet started.
