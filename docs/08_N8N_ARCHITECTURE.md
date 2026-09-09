# §08 — N8N AS THE AUTOMATION LAYER
### Assessment, revised architecture, and what actually changes

**Short answer: yes for roughly 60% of the system, and it makes that 60% substantially better. No for the rest, and the boundary matters.**

n8n was already in your spec — Compass §1.4 Category 1 ("automation mapping: manual workflow → Zoho Flow or n8n design") and Forge §1.7 Category 4 ("Zoho Flow / n8n flows supporting Compass"). So this is not a new dependency. You are proposing to promote it from a tool one agent uses to the substrate several agents run on. That is a defensible promotion and I think you are right.

Facts below were checked against current sources in September 2026, not recalled.

---

## 1. WHY YOUR INSTINCT IS RIGHT

### 1.1 It deletes most of Phase 3

Phase 3 of your build spec is Google Sheets → Docs → Calendar → Gumroad → Base44 → Zoho. That is 3–4 days of OAuth flows, token refresh, pagination, rate-limit handling, and error retries — the least interesting code in the entire project, and the code most likely to break silently at 3am.

n8n ships pre-built nodes for essentially all of it, with OAuth handled in its credential store. **This is the single biggest win and it is not close.**

### 1.2 The autonomy protocol maps onto n8n natively

This is the finding that changed my view, and it is worth reading carefully.

Your entire system rests on this loop:

```
INSTRUCTION → PARSE → PLAN → CLARIFY? → EXECUTE → CONFIRM? → REPORT
                                              ↑
                                    pause here if irreversible
```

That "pause and confirm before an irreversible action" is a **human-in-the-loop gate**, and it is the hardest part of the system to build correctly in ordinary code. You need durable state, a resumable job, a timeout policy, and a way to not lose the work if the process restarts while waiting.

n8n has this as a first-class primitive. The **Wait** node pauses a workflow, *offloads its execution state to the database*, and resumes when a condition is met — including **"On Webhook Call"**, which exposes a unique resume URL per execution and supports Basic, Header, or JWT authentication on it.

Better still: the Telegram node has a native **"Send and Wait for Approval"** operation that sends a message and pauses the workflow until someone responds.

So your confirm gate becomes:

```
  Compass drafts Elif's evaluation
        │
        ▼
  [ Wait — Send and Wait for Approval ]  ← execution state persisted to DB
        │                                   costs nothing while waiting
        │                                   survives a restart
        ├── you approve in Telegram ────────┐
        └── you approve in the app ─────────┤ (app POSTs the resume URL)
                                            ▼
                            sends to Qarint + Teams + Telegram
```

And the board's `blocked` state from §07 §2.3 is now literally "an n8n execution parked on a Wait node." The Asks screen lists parked executions. Answering one calls its resume URL. **That is a much cleaner mechanism than the one I specced**, and it comes free.

### 1.3 It is a real agent runtime now, not just a plumbing tool

n8n 2.0 shipped in January 2026 with native LangChain integration and 70+ AI nodes: an **AI Agent** node that wraps LangChain primitives, sub-nodes for the language model, **memory nodes** (Window Buffer, Summary, and external memory backed by Postgres or Redis), and **tool nodes** the agent can invoke.

So each of your seven agents can genuinely be an n8n AI Agent workflow with Claude as the model, its own tool set, and its own memory — rather than seven hand-rolled orchestration loops.

### 1.4 You can edit it without me

This one is worth more than it looks. Right now every change to the automation layer requires a coding session. In n8n you open a canvas and move a node. When you decide the Mid-Day Pivot should fire at 12:30, or that competition reminders should be 10/5/1 days instead of 7/3/1, that is a thirty-second edit you make yourself.

Given that this is a personal system you will tune for years, that matters more than almost any technical argument.

### 1.5 It is free to self-host

n8n's Community Edition is free to self-host with unlimited executions and all integrations. There is no permanent free tier on n8n Cloud — that starts around $20–24/month — so **self-hosted is the only free path**, and it is a real one.

---

## 2. WHAT N8N CANNOT DO — THE BOUNDARY

I want to be blunt here, because the failure mode of "let's do it all in n8n" is discovering the gap in week three.

### 2.1 It cannot build your interface

The bubbles, the 3D brain, the board, the Home screen, the reference image you pinned — **none of that is buildable in n8n.** n8n has no frontend capability whatsoever. Your dashboard is a React application regardless of this decision. The entire Impeccable design workflow in §01–§03 is unaffected.

This is the part you care about most visually, and n8n contributes nothing to it. That is not a criticism of n8n; it is simply not what it is for.

### 2.2 It cannot satisfy your security checklist

Build Spec §6 requires argon2id password hashing, TOTP two-factor, `__Host-` prefixed session cookies with CSRF protection, row-level security scoped to a session user, field-level AES-256-GCM encryption, single-user enforcement rejecting any non-matching identity, and strict schema validation rejecting unknown fields.

n8n has authentication for *its own editor*. It does not provide any of the above for *your application*. That layer is yours to build in the app, exactly as specced. **n8n changes nothing about Phase 1.**

There is also a new consideration: a self-hosted n8n instance holding OAuth credentials for your Google account, Gumroad, Zoho, and your Telegram bot token becomes a high-value target. It needs to be locked down as carefully as the app — not exposed to the internet except for the specific webhook paths, and those authenticated.

### 2.3 Complex state and logic get worse, not better

The memory classifier with supersede chains, the spaced-repetition scheduler, the Portuguese curriculum sequencer that gates lesson N on refresher N-1 — these are algorithms. In n8n they become long chains of Code nodes, which is still code, but code you cannot unit-test, cannot diff meaningfully in git (workflows are JSON blobs), and cannot review in a pull request.

**Rule of thumb: if it is a sequence of API calls, n8n. If it is a decision procedure, code.**

### 2.4 Version control is genuinely worse

Workflow JSON diffs are close to unreadable. You will lose the ability to review changes to the automation layer the way you review code. Mitigations exist — export workflows to the repo on a schedule, keep Code node contents in separate files where practical — but it is a real regression and you should accept it knowingly.

---

## 3. THE SPLIT

```
┌──────────────────────────────────────────────────────────────┐
│  NIXON APP  (React + Express + Supabase)                      │
│                                                               │
│  • The dashboard — Home, Board, Asks, Chat, Settings          │
│  • The pinned visual world, the bubbles, the 3D               │
│  • Auth: argon2id, TOTP, sessions, CSRF, single-user gate     │
│  • Postgres schema, RLS, field-level encryption               │
│  • Memory layer: capture, classify, standing instructions     │
│  • Board state machine                                        │
│  • THE DATABASE IS THE SOURCE OF TRUTH                        │
└───────────────┬───────────────────────────┬──────────────────┘
                │                           │
      app calls n8n webhook          n8n calls app API
      "run this job"                 "job done / I need input"
                │                           │
┌───────────────▼───────────────────────────▼──────────────────┐
│  N8N  (self-hosted, Community Edition)                        │
│                                                               │
│  • Every scheduled trigger — the 4 pulses, lessons, quizzes   │
│  • Every external integration — Google, Gumroad, Zoho, Base44 │
│  • Telegram send + receive, inline keyboards                  │
│  • Notification fan-out (push + Telegram + in-app)            │
│  • The seven agents as AI Agent workflows (Claude as model)   │
│  • Human-in-the-loop confirm gates via Wait nodes             │
│  • Retry, backoff, and error handling — built in              │
└───────────────────────────────────────────────────────────────┘
                                │
                    both read and write the same
                         Supabase Postgres
```

**Redis is no longer needed.** BullMQ was in the stack to provide scheduling, retry, and backoff. n8n provides all three. That removes a dependency and simplifies the local setup — a small but real win.

---

## 4. FUNCTION-BY-FUNCTION MAPPING

Every function from §04, reassigned. `n8n` = a workflow. `app` = application code. `both` = n8n orchestrates, app holds state or logic.

### Nixon
| ID | Function | Owner | Note |
|---|---|---|---|
| NX-1 | Route instruction | both | App classifies and persists; n8n executes |
| NX-2–5 | The four pulses | **n8n** | Schedule Trigger → query Supabase → fan out |
| NX-6 | Batch updates | **n8n** | Queue in DB, drain on pulse |
| NX-7 | Urgency gate | **n8n** | IF node on deadline / failure / confirmation-needed |
| NX-8 | Quiet hours | **n8n** | IF node + Wait-until-time. **Fixes defect A-4** — set the instance TZ and use n8n's own date handling |
| NX-9 | Status check | both | n8n gathers, app renders |
| NX-10 | Overload watch | **n8n** | Daily Schedule Trigger over the board |
| NX-11 | /pause /resume | **n8n** | Telegram Trigger → flag in DB |

### Helix
| ID | Function | Owner | Note |
|---|---|---|---|
| HX-1 | Log a lab step | **n8n** | Telegram Trigger → AI Agent → Google Sheets node |
| HX-2 | Reasoning columns | **n8n** | AI Agent with Claude |
| HX-3 | Never-invent guard | **app** | A validation rule, not a workflow. Enforced in the prompt *and* checked in code |
| HX-4–8 | Deviations, reminders, flags, rollup | **n8n** | Schedule + Sheets nodes |
| HX-9–13 | Thesis drafting, citations, literature | **n8n** | AI Agent + Google Docs + HTTP nodes for PubMed |
| HX-14–16 | Presentation | **n8n** | AI Agent workflows |
| HX-17–19 | Daily concept, spaced repetition, quiz | **n8n** | Schedule Trigger + Telegram inline keyboards |
| HX-20 | Health-advice boundary | **both** | In the agent's system prompt, **and** a hard check in app code before delivery. A boundary this important does not live in a prompt alone |

### Ember
| ID | Function | Owner | Note |
|---|---|---|---|
| EM-1 | Manuscript review | **n8n** | Google Docs read → AI Agent. **Read-only credential** — enforce "Ember does not write" at the credential level, not just the prompt |
| EM-2 | Progress tracking | **n8n** | Schedule + Docs |
| EM-3–5 | Social calendar, packaging, post prep | **n8n** | Prepare-and-hand-over via Telegram |
| EM-6–8 | Competition search, filter, reminders | **n8n** | HTTP + AI Agent + Sheets + Schedule |
| EM-9–10 | @neurogenicole, unified tracker | **n8n** | Sheets |
| EM-11 | Auto-post | **n8n** | Behind a Wait/approval gate. Only if API access is granted |

### Compass
| ID | Function | Owner | Note |
|---|---|---|---|
| CP-1–4 | SOPs, automation mapping, calendars, campaigns | **n8n** | Zoho + Google Calendar nodes |
| CP-5–6 | Student matrix, lesson planning | **n8n** | Sheets + Docs |
| CP-7 | **Evaluation generator** | **n8n** | AI Agent producing all three formats |
| CP-8 | **Send evaluation** | **n8n** | **Wait node — "Send and Wait for Approval".** The textbook case |
| CP-9 | Daily admin | **n8n** | Schedule |
| — | Student-data isolation | **app** | Field encryption + scoped retrieval. Not delegable to a workflow |

### Ledger, Cadence, Forge
| ID | Function | Owner | Note |
|---|---|---|---|
| LG-1–10 | All product, copy, and analytics work | **n8n** | Gumroad + Drive + Sheets nodes |
| LG-11 | Publish to Gumroad | **n8n** | Wait gate |
| CD-1–3 | Lesson, quiz, sequencing | **n8n** | Schedule + Telegram inline keyboards |
| CD-4 | Refresher **gates** the lesson | **both** | The gate is a state machine — **app**. n8n queries it before sending |
| CD-5 | Spiral review | **both** | Scheduling algorithm in app; delivery in n8n |
| CD-7–8 | European-not-Brazilian, no invented slang | **both** | Prompt **and** code check |
| FG-1–4 | IC₅₀, heatmap, resistance index, dilution | **app** | These are calculators with a UI. Not workflows |
| FG-5 | Base44 knowledge tracker | **n8n** | HTTP node |
| FG-6–7 | Portfolio, WordPress theme | **app** | Separate projects |
| FG-8–9 | Google syncs, n8n flows | **n8n** | This is n8n being n8n |
| FG-11 | Telegram + push bridge | **n8n** | Improvement C-7 becomes one workflow with three branches |
| FG-12 | Deploy | **app** | Behind confirmation |

**Roughly 45 of 60 functions move to n8n.** The 15 that stay are: security, state machines, calculators, boundary enforcement, and the UI.

---

## 5. THE MEMORY LAYER, REVISED FOR N8N

§07 Part 1 needs one adjustment. n8n's memory nodes give you **conversation window memory** keyed by session — typically a Postgres table of messages plus a rolling summary. That covers short-term context well.

It does **not** cover standing instructions, supersede chains, or thread scoping. So:

```
  n8n Postgres Chat Memory   →  the last N turns of this conversation
                                 (n8n manages this, you get it free)

  app memory_items table     →  standing instructions, profile, project state,
                                 preferences, supersede history, scoping
                                 (yours, per §07 §1.8)
```

And the rule from §07 §1.4 still binds: **before every AI Agent run, the app injects all active standing instructions into the agent's system prompt.** In n8n that is one HTTP Request node at the top of each agent workflow, fetching `GET /api/memory/context?agent=ember&thread=creative`, whose response is templated into the system message.

Never let n8n's vector store retrieve standing instructions by similarity. Same reasoning as before: a safety rule that is *usually* retrieved is a safety rule that fails on the day it matters.

---

## 6. WHAT THIS DOES *NOT* FIX

**Hosting.** I want to be direct because it would be easy to assume otherwise: **n8n on your laptop has exactly the same problem as the app on your laptop.** Its Schedule Triggers do not fire while the machine is asleep. Moving the automation into n8n does not move it off your hardware.

So Constraint 1 from `00_START_HERE.md` still stands, and n8n slightly changes the options:

| Option | Cost | Verdict |
|---|---|---|
| n8n on your laptop | free | Automations fire only while it is awake. Fine for building, not for living with |
| n8n on Oracle Cloud Always Free | free | A genuinely free always-on VM. Card required for verification; ARM capacity is often unavailable in popular regions |
| n8n on a small VPS | ~$5–7/mo | The conventional answer, and what most self-hosters do |
| n8n Cloud | ~$20–24/mo | No permanent free tier |
| Supabase Edge Functions for triggers only, n8n local for the rest | free | Awkward split, but it works: pulses fire from Supabase, heavy work waits for your laptop |

**My recommendation, given you want free:** develop with n8n locally now, and treat always-on hosting as a decision you make when the system is actually worth keeping awake. Nothing in the architecture changes when you move it — that is one of the benefits of the split.

---

## 7. HONEST RISKS

1. **Debugging across two systems.** When the Morning Brief does not arrive, the cause is in the app, in n8n, in Supabase, or in FCM. Mitigate with a single correlation ID written by the app and carried through every n8n node into the logs.
2. **Workflow sprawl.** Seven agents × several functions each is easily 40+ workflows. Without a naming convention and sub-workflow discipline this becomes unmaintainable within months. Adopt `agent.function` naming from day one and factor shared logic into sub-workflows.
3. **Credential concentration.** One n8n instance will hold Google, Zoho, Gumroad, Telegram, and Base44 credentials. That is a bigger blast radius than the current design. It needs the same hardening as the app.
4. **Version control regression.** Real, discussed in §2.4. Export workflows to the repo on a schedule so at least there is a recoverable history.
5. **Prompt-only guardrails.** n8n makes it tempting to enforce "never invent" and the health-advice boundary purely in a system prompt. **Do not.** Those checks belong in app code on the path between the agent and delivery, per the mapping table above.

---

## 8. REVISED BUILD PHASES

| Phase | Before | After |
|---|---|---|
| **1 — Foundation** | Repo, auth, schema, RLS, security checklist | **Unchanged.** n8n does not touch this. Add: n8n installed via Docker, locked down, first workflow round-trips to the app |
| **2 — Agents** | Seven agents hand-built in code | Seven **n8n AI Agent workflows**. Faster, and each is testable by clicking Execute |
| **3 — Integrations** | 3–4 days of API glue | **Largely deleted.** Connect credentials, drop in nodes. Perhaps 1 day |
| **4 — Automations + UI** | Pulses, push, dashboard | Pulses and push become n8n workflows. **The dashboard is unchanged and is now the bulk of the remaining work** |

**Net effect: the automation layer gets substantially faster to build, and the UI becomes the critical path.** Which, given that the UI is the part you have a pinned design for and care most about, is a good place for the critical path to be.

---

## 9. DECISIONS

1. **Confirm the split**, or tell me where you want the boundary moved.
2. **Redis drops out** — confirm you are fine with that (n8n replaces BullMQ).
3. **Where does n8n run** during the build — local Docker, or set up always-on hosting now?
4. **Do the seven agents each get their own n8n workflow**, or one router workflow with seven branches? I recommend one workflow per agent: clearer to edit, easier to disable one without touching the others.
