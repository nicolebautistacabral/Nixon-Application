# §07 — TWO NEW REQUIREMENTS
### "Agents should note and remember everything I say" · "A page for my to-do list, done and in progress, per agent"

Both of these are additions to the original four documents. They are also, usefully, **one pipeline** — what you say gets captured, classified, and where it is a task it lands on the board. Specced together for that reason.

---

# PART 1 — THE MEMORY LAYER
### "Everything I send in the chatbox should be recognised by agents to take note and remember"

## 1.1 What you are asking for, stated precisely

Three distinct things, and they need different machinery:

1. **Capture** — nothing you type is ever lost, even if the system misunderstands it.
2. **Comprehension** — the agent understands what you meant, not just what you typed.
3. **Persistence** — it still knows next week, in a different thread, without you repeating yourself.

Your Master Prompt already asks for #2 (Part 2, the inference protocol) and gestures at #3 (Part 6.4, "context carries forward"). Neither was specified as a mechanism. This is that mechanism.

## 1.2 The capture guarantee

Every message you send is written verbatim to an **append-only** table before anything else happens. No classification, no summarisation, no interpretation stands between you and the record.

```
messages (id, user_id, thread, agent_id, role, body, attachments, created_at)
```

Append-only means: never updated, never deleted. If the classifier gets something wrong six months from now, the original sentence is still there and the memory can be rebuilt from it. This is the floor, and it costs nothing.

## 1.3 Classification — what happens to a message after capture

Every message is classified into one or more categories. A single sentence can be several at once.

| Category | Example from your own use | Where it goes | Lifetime |
|---|---|---|---|
| **Standing instruction** | "Always ask before sending anything" | `memory_items`, kind `standing_instruction` | Until you revoke it |
| **Boundary** | "Only competitions with deadlines before 2026-12-31" | Same, scoped to Ember | Until revoked |
| **Task** | "Get me competitions" | **Board item** (Part 2) | Until done |
| **Profile fact** | "My supervisors are Isabel Veiga and Joana Pereira-Sousa" | `memory_items`, kind `profile` | Durable |
| **Project state** | "We're on WP2 now" | `memory_items`, kind `project`, scoped to the thesis | Until superseded |
| **Preference** | "I prefer dense answers, not long ones" | `memory_items`, kind `identity` | Durable |
| **Correction** | "No, I meant Dd2, not 3D7" | Supersedes a prior item, keeping history | Durable |
| **Observation** | "A1 looked weird today" | Logged to the thread; may become a lab entry | Contextual |
| **Conversation** | "thanks" / "ok" | Stored in `messages`, promoted to nothing | Raw only |

Your Build Spec already names **three memory layers** under Nixon: Identity (how Nixon behaves), Profile (who Nicole is), Project Blueprints (per-project north stars). The table above maps onto those, and adds standing instructions as a fourth layer — because your Master Prompt Part 2.3 gives them *higher priority than vague current instructions*, and a rule that outranks other rules needs to be stored where it cannot be missed.

## 1.4 The retrieval rule — and the one engineering decision that matters most

When any agent is about to act, it loads:

```
  ALWAYS, in full, never searched:
    ├─ identity memory        (how Nixon behaves)
    ├─ profile memory         (who you are)
    └─ ACTIVE STANDING INSTRUCTIONS for this agent + global
                              ← these are ALWAYS injected

  RETRIEVED by relevance:
    ├─ project blueprint for the current thread
    ├─ recent messages in this thread
    └─ related past decisions
```

**Standing instructions are never fetched by similarity search.** They are loaded in full, every time, unconditionally.

This is the single most important decision in this document, so here is why. If "never post without asking first" is stored as one item among hundreds and retrieved by semantic similarity, then one day you say "publish the piece", the search does not surface that rule strongly enough, and the system posts. The rule failed silently at the exact moment it mattered. Standing instructions are few — realistically dozens, not thousands — so they are cheap to always include. Convenience is never a reason to make a safety rule probabilistic.

## 1.5 You must be able to see what it decided to remember

A memory that accumulates rules you cannot see is a liability, not a feature. Two mechanisms:

**Immediate, lightweight confirmation.** When a message is promoted to a standing instruction or boundary, you see it right there in the chat — a single line, not a dialog:

> ✓ Noted as a standing rule for Ember — *only zero-fee competitions with deadlines before 2026-12-31*. &nbsp;&nbsp;[undo]

Nothing appears for tasks, observations, or ordinary conversation; those are visible in the board and the thread already. Only rules that will silently govern future behaviour announce themselves.

**A memory page** where every item is listed, filterable by agent and kind, each showing the original sentence it came from, when it was captured, and when it was last applied. You can edit, revoke, or re-scope any item. Revoking keeps history — the item is marked revoked, not deleted, so "why did it stop doing that" is always answerable.

**The fork here, and I recommend (b):**
- (a) Promote silently, summarise in the next daily pulse
- **(b) Promote immediately with an inline undoable confirmation** ← recommended
- (c) Propose only; you confirm each one before it takes effect

(c) is death by a thousand confirmations, which is the exact failure mode your Master Prompt Part 2 was written to prevent. (a) lets rules accumulate invisibly for up to a day. (b) costs you one line of reading and gives you an undo.

## 1.6 Contradictions

When something you say conflicts with an active standing instruction, the system does not silently pick one. Per your Master Prompt Part 2.3, it asks **once, bundled**:

> You told me in March: *only competitions with deadlines before 2026-12-31.* You're now asking for anything in the next 90 days, which goes past that. Replace the old rule, or keep it and filter?

Whichever you choose, the old item is marked `superseded` with a pointer to the new one. The chain is preserved, so the history of a rule is always reconstructible.

## 1.7 Thread scoping — the privacy rule, enforced structurally

Your Build Spec §7 requires that a student's name never appears outside their evaluation thread and that threads never leak into each other. Memory is the most likely place for that to break, because memory is precisely the thing designed to carry context across boundaries.

So every memory item carries a **scope**: `global`, or a specific thread, or a specific agent. A memory captured in the tutoring thread with `scope = compass/tutoring` is not loadable by Helix drafting a thesis section. This is enforced at the query, not by prompt instruction — an agent physically cannot retrieve out-of-scope memory.

Items containing student names or health data are additionally flagged and stored field-encrypted, per §6.5.

## 1.8 Schema

```sql
-- Verbatim capture. Append-only. Never updated, never deleted.
CREATE TABLE messages (
  id              UUID PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES users(id),
  thread          TEXT,
  agent_id        UUID REFERENCES agents(id),
  role            TEXT NOT NULL CHECK (role IN ('user','agent','system')),
  body            TEXT NOT NULL,
  attachments     JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- What the system concluded. Visible, editable, revocable.
CREATE TABLE memory_items (
  id                 UUID PRIMARY KEY,
  user_id            UUID NOT NULL REFERENCES users(id),
  kind               TEXT NOT NULL CHECK (kind IN
                       ('identity','profile','project','standing_instruction','preference')),
  scope              TEXT NOT NULL DEFAULT 'global',  -- 'global' | thread slug
  agent_id           UUID REFERENCES agents(id),      -- NULL = applies to all
  content            TEXT NOT NULL,
  source_message_id  UUID REFERENCES messages(id),    -- the sentence it came from
  status             TEXT NOT NULL DEFAULT 'active' CHECK (status IN
                       ('active','superseded','revoked')),
  supersedes_id      UUID REFERENCES memory_items(id),
  is_sensitive       BOOLEAN NOT NULL DEFAULT false,  -- field-encrypt content
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed_at       TIMESTAMPTZ,
  last_applied_at    TIMESTAMPTZ,
  revoked_at         TIMESTAMPTZ
);

CREATE INDEX ON memory_items (user_id, kind, status)
  WHERE status = 'active';
```

Both tables get row-level security and `user_id`, per §6.4 and correction B-4.

## 1.9 What this changes about the Chat screen

Stage 6 in §03 gains one element: the inline "noted" confirmation line. It must be quiet — one line, dismissible, never a modal. This is the detail most likely to be built badly, and it is worth a specific review pass when we get there.

---

# PART 2 — THE BOARD
### "A page where I see my to-do list, completed and in progress, with each agent on it"

## 2.1 Where it lives — and why not a sixth tab

Your reference image has a **five-block bottom navigation**: HOME · TASKS · ASKS · CHAT · SETTINGS. That five-block composition is part of the pinned brief. Adding a sixth tab breaks it, and breaking a pinned brief for a feature that fits elsewhere is the wrong trade.

**Recommendation: the board becomes what Tasks actually is.** Tasks currently means "system jobs running, queued, failed" — which is a developer's view, not yours. Replace it with two views under one tab:

```
  TASKS
  ┌─────────────┬──────────────┐
  │   BOARD     │   ACTIVITY   │      ← segmented control, top of screen
  └─────────────┴──────────────┘
   your work,      system jobs:
   per agent,      running, queued,
   to-do →         failed, retrying
   in progress →
   done
```

Board is the default and the thing you look at. Activity is where you go when something seems stuck. Nav stays five blocks. Reference preserved.

**The alternative** — a sixth tab — is available if you want the board to be a genuinely separate place. Say so and I will re-derive the nav for six blocks. It is your reference; I am not going to quietly protect it against your own preference.

## 2.2 What a board item is

Not a system job. A **unit of your work**, which may take an agent several jobs to complete.

| Field | Meaning |
|---|---|
| Title | What needs doing, in your words where possible |
| Agent | Which of the seven owns it |
| Thread | Which of the six lives it belongs to |
| State | `todo` → `in_progress` → `done`, plus `blocked` and `cancelled` |
| Origin | `user` (you asked), `agent` (it decomposed something), `schedule` (recurring) |
| Source message | The thing you said that created it — tappable, jumps to that message |
| Due | Optional, and never invented by an agent |
| Outputs | What was actually produced: the Sheet row, the Doc, the sent evaluation |

## 2.3 The states, and what moves between them

```
                    ┌──────────────────────────────┐
                    ▼                              │
   [ todo ] ──→ [ in_progress ] ──→ [ done ]       │
                    │                              │
                    ▼                              │
               [ blocked ] ──── ask answered ──────┘
                    │
                    ▼
              [ cancelled ]
```

- **todo** — captured, not started
- **in_progress** — an agent is actively working it
- **blocked** — waiting on you. **This is the link to the Asks screen**: a blocked item always has an open ask, and answering the ask returns it to `in_progress` automatically
- **done** — finished, with its outputs attached
- **cancelled** — you called it off; kept, not deleted

`blocked` is the state that makes the whole autonomy protocol visible. Right now, in your original spec, a job waiting on a decision is invisible unless you happen to open Asks. Here it sits on the board, in that agent's lane, obviously stuck.

## 2.4 Layout — mobile first, at 390px

Agent lanes as horizontal Kanban columns is a desktop pattern and it is genuinely bad on a phone. What works at 390px:

```
  ┌────────────────────────────────────┐
  │  BOARD          ACTIVITY           │   segmented
  ├────────────────────────────────────┤
  │ ● All  ○ Helix ○ Ember ○ Compass  →│   agent filter chips, scrollable,
  │                                    │   each in that agent's colour,
  │                                    │   each with a count badge
  ├────────────────────────────────────┤
  │  IN PROGRESS                    3  │
  │  ┌──────────────────────────────┐  │
  │  │ ◐ Draft Methods section      │  │
  │  │   Helix · thesis · 2h        │  │
  │  └──────────────────────────────┘  │
  │  ...                               │
  ├────────────────────────────────────┤
  │  BLOCKED                        1  │   ← red, always directly under
  │  ┌──────────────────────────────┐  │      in-progress, never buried
  │  │ ⏸ Send Elif's evaluation     │  │
  │  │   Compass · waiting on you   │  │
  │  │   [ answer → ]               │  │
  │  └──────────────────────────────┘  │
  ├────────────────────────────────────┤
  │  TO DO                          7  │
  ├────────────────────────────────────┤
  │  DONE TODAY                     4  │   collapsed by default
  └────────────────────────────────────┘
```

Grouped by **state**, filtered by **agent**. Not grouped by agent — because your actual question in the morning is "what is moving and what is stuck", not "what is Ledger up to". The agent filter is there when you do want the per-agent view, and the chips carry each agent's colour from §02 §4 so the mapping to the bubbles is immediate.

On desktop, the same data goes wide: seven agent columns, states as rows.

## 2.5 The completed view — the part worth building properly

You asked specifically for completed. A list of ticked boxes is not worth a screen. What makes it worth opening is **what was produced**.

```
  YESTERDAY · Monday 8 September
  ─────────────────────────────────────────
  ✓ Log WP2 plate 14              Helix
    → 6 rows added to Logbook Sheet ↗
    → 1 deviation flagged: DMSO 0.6%

  ✓ Evaluate Elif Kaya            Compass
    → sent to Qarint, Teams, Telegram ↗

  ✓ Portuguese lesson 47          Cadence
    → quiz scored 8/10
```

Every completed item links to the artifact it produced. This turns the completed view into a record of work — which is also, incidentally, what you need when writing your thesis progress reports and when your supervisors ask what happened in a given week.

**Default range: 7 days**, with the full history searchable. Not infinite scroll — a date filter.

## 2.6 Where items come from

```
  You type in chat  ──→ classifier says "task" ──→ board item (origin: user)
                              │
                              └──→ links back to the source message

  Agent decomposes  ──→ sub-items under a parent (origin: agent)

  You add manually  ──→ board item (origin: user)

  Schedule fires    ──→ board item (origin: schedule)
                        e.g. Cadence lesson, weekly rollup
```

The first path is where Part 1 and Part 2 meet. You say "get me competitions"; that becomes a board item on Ember, in progress, with the sentence you typed attached to it.

## 2.7 This closes the loop on bubble size

Your answer to §06 #7 was that bubble size means **open items**. That is now precisely defined:

```
  bubble_size(agent) ∝ count(board_items
                             WHERE agent = agent
                             AND state IN ('todo','in_progress','blocked'))
```

And the urgent caustic on a bubble is `count(state = 'blocked') > 0`.

So the Home screen is a live view of the board, and the board is the detail view of the Home screen. They are the same data at two densities. That is what makes the bubbles information rather than decoration — the thing §02 §6 was arguing for, now with an actual definition behind it.

## 2.8 Schema

Your existing spec already has a `tasks` table:

```sql
tasks (id, agent_id, thread, title, body, status, due_at, priority, created_at)
```

**Extend it rather than adding a parallel table.** Same concept, more states, plus provenance and outputs:

```sql
ALTER TABLE tasks
  ADD COLUMN user_id           UUID NOT NULL REFERENCES users(id),  -- correction B-4
  ADD COLUMN state             TEXT NOT NULL DEFAULT 'todo'
             CHECK (state IN ('todo','in_progress','blocked','done','cancelled')),
  ADD COLUMN origin            TEXT NOT NULL DEFAULT 'user'
             CHECK (origin IN ('user','agent','schedule')),
  ADD COLUMN source_message_id UUID REFERENCES messages(id),
  ADD COLUMN parent_id         UUID REFERENCES tasks(id),
  ADD COLUMN blocking_ask_id   UUID REFERENCES asks(id),
  ADD COLUMN started_at        TIMESTAMPTZ,
  ADD COLUMN completed_at      TIMESTAMPTZ,
  ADD COLUMN cancelled_at      TIMESTAMPTZ;

-- What a completed item actually produced.
CREATE TABLE task_outputs (
  id          UUID PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES users(id),
  task_id     UUID NOT NULL REFERENCES tasks(id),
  kind        TEXT NOT NULL,   -- 'sheet_row' | 'doc' | 'message_sent' | 'file' | 'note'
  label       TEXT NOT NULL,   -- "6 rows added to Logbook Sheet"
  url         TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ON tasks (user_id, agent_id, state);
CREATE INDEX ON tasks (user_id, completed_at DESC) WHERE state = 'done';
```

The old `status` column is superseded by `state` and dropped once nothing reads it.

## 2.9 What this adds to the build

| Stage in §03 | Change |
|---|---|
| Stage 1 | `messages`, `memory_items`, `task_outputs` tables and RLS added to the schema |
| Stage 3 | Bubble size now has a real query behind it |
| Stage 5 | Tasks becomes Board + Activity. Roughly double the original scope for this stage — call it 2 days, not 1 |
| Stage 6 | Chat gains the inline "noted" confirmation and message capture |
| **New** | A memory page. Reachable from Settings, not the main nav. Half a day |

Net: roughly **+2 days** on the original estimate.
