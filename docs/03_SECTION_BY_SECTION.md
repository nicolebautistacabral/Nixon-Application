# §03 — SECTION BY SECTION
### The build in order. What you review and edit at each stage.

Each section below is a **checkpoint**. You see something, you say what is wrong, we fix it, we move on. You never have to hold the whole system in your head.

Format for each: what gets built → what you can change → what "done" means → how it is verified.

---

## STAGE 0 — SETUP  *(half a day, no UI)*

**Built:** Impeccable installed. `/impeccable init` run. `PRODUCT.md` written and confirmed by you. Repo scaffolded, `.env.example`, `.gitignore`, gitleaks pre-commit hook.

**You edit:** `PRODUCT.md` — this is the one document that governs every later decision. Read it line by line. If it says something you did not mean, fix it now; it is expensive later.

**Done when:** `PRODUCT.md` exists, you have read it, and `gitleaks detect --source . --verbose` passes on full history.

**Verified by:** you reading the file.

---

## STAGE 1 — FOUNDATION  *(Phase 1 of your Build Spec — 2–3 days, no UI)*

**Built:** Postgres schema + RLS on every table. Single-user auth: argon2id + TOTP. Session cookies with `__Host-` prefix, httpOnly, secure, sameSite. Helmet, CSP, HSTS. Rate limiting. Telegram bot connected, sends one test message.

**You edit:** nothing visual. You supply: Telegram bot token, hosting decision, Postgres choice.

**Done when:** every box in Build Spec §6 is ticked, including the four manual penetration attempts:
- access a record while logged out → **must fail**
- tamper with an ID in a request → **must fail**
- send an unknown field in a payload → **must fail**
- post to the Telegram webhook from an unknown chat ID → **must fail**

**Verified by:** I show you the output of each attempt. Not a claim that it passed — the actual terminal output.

**Gate: Phase 2 does not start until this passes.** That is your rule and I am keeping it.

---

## STAGE 2 — THE VISUAL WORLD  *(the direction round — 1 day, mostly yours)*

**Built:** Nothing yet. This is the decision.

**What happens:** I run the direction round with your reference image pinned as a binding brief. A decision page opens in your browser with cards. Because comp-first is recommended, each card carries a generated comp — a full-fidelity image of what Home would actually look like in that direction.

**You edit:** you pick one. You can steer ("bolder", "safer", or free text) and re-roll. A pinned brief beats the roll, so the reference world is locked; what you are choosing between is *composition* — how the six bubbles arrange, where the command bar sits, how state reads.

**Done when:** you lock a card. That writes the **Direction Contract** into the surface brief — six blocks, 150 words. I will show it to you.

**Verified by:** you can read the contract and recognise your app in it. If it reads like a mood ("modern, clean, engaging"), it is not decided yet and we go again.

---

## STAGE 3 — HOME  *(the hardest screen — 3–4 days)*

This is where your reference actually gets built, and where most of the fix rounds happen.

### 3a — Plates (the assets)
**Built:** The brain raster. Six bubble rasters, one per agent, alpha-keyed. Background gradient plate with bokeh. Each generated at ≥1.5× its display size and scored against the comp crop.

**You edit:** reject any asset that does not look right. This is cheap to redo now and expensive after the layout is built on top of it.

**Done when:** every plate exists, is at correct resolution, and reads as its region.

### 3b — Hero (the first viewport, at the comp's exact size)
**Built:** Plates placed at their measured boxes first. Then the semantic layer over them: wordmark, tagline, command bar, bubble labels, bottom nav.

**You edit:** position, scale, the command bar's prominence.

**Done when:** `comp-diff` scores ≥72% overall with no hard veto (no missing region, no contradicted plate, no invented ink where the comp is calm). Below that, I get numeric readings — *"cap height 78px in the build, 103px in the comp"* — and those numbers are the edit list.

**Verified by:** side-by-side, heatmap, and per-region crops written to `.impeccable/review/diff/hero/`. You look at the side-by-side.

### 3c — State
**Built:** What a bubble looks like idle / working / blocked / has-an-ask. Bubble size bound to open-item count. The brain bound to "is a job running".

**You edit:** **this is the section where you have the most to say.** Does bubble size mean open items, or urgency, or time-since-touched? Does the brain pulse mean "thinking" or "unread"? These are your daily-use decisions, not mine.

**Done when:** every state is visible on screen with real data, not a mockup.

### 3d — Responsive
**Built:** 390px first (your spec), then 768, then 1280–1600. Bottom nav on mobile, sidebar on desktop.

**Done when:** the desktop capture diffs clean against the comp and the 390px capture has no horizontal scroll, no clipped bubble, and every touch target ≥44×44px.

### 3e — Finish
Detector pass → fresh reviewer with no access to my history → verdict word → fixes → `DESIGN.md` checkpoint.

---

## STAGE 4 — ASKS  *(the screen that matters most operationally — 1–2 days)*

Asks carries the red badge. It is where the autonomy protocol surfaces: an agent is blocked and needs a decision from you.

**Built:** A list of pending decisions. Each shows: which agent, what it is trying to do, what it inferred, the specific question, and the options. One-tap answer. Answering unblocks the job immediately.

**You edit:**
- **How much context each ask shows before you tap in.** Too little and you have to open every one; too much and the list is a wall.
- **Whether asks can be bulk-answered.**
- **What happens to an unanswered ask after 24h** — escalate, expire, or sit there.

**Done when:** you can clear three asks in under thirty seconds on your phone.

**Design note:** this screen is `Operate` at its most extreme. `quieter` almost certainly gets run on it. The gradient world stays as an edge, not a ground.

---

## STAGE 5 — TASKS  *(1 day)*

**Built:** What is running, what is queued, what failed. Grouped by thread. Each row: agent, action, elapsed time, state.

**You edit:** grouping (by thread, by state, or by time?), and whether failed jobs auto-retry or wait for you.

**Done when:** you can tell at a glance whether anything is stuck.

---

## STAGE 6 — CHAT  *(2 days)*

**Built:** The conversation surface. Agent selection, thread context, the inference-transparency line (*"I'm interpreting 'log that' as: WP2 plate, hematocrit 2%, edge-effect flag on A1"*).

**You edit:** **how the inference explanation is displayed.** Your Master Prompt Part 6.2 requires transparency on every inference. Done badly that is noise on every single message. Done well it is a quiet, dismissible line. This needs your eye.

**Done when:** you can give one instruction and read back exactly what was understood, without the explanation dominating the message.

---

## STAGE 7 — SETTINGS  *(1 day)*

**Built:** Notification controls (push on/off, sound, vibration, quiet hours), pulse times, thread visibility, integration status, TOTP management.

**You edit:** what is exposed versus buried. Your Build Spec calls for `/settings` in Telegram too — both surfaces must agree.

**Done when:** every setting that exists in the database is reachable from the UI, and changing one takes effect without a restart.

---

## STAGE 8 — AUTOMATION  *(Phase 4 — 2–3 days)*

**Built:** Four daily pulses. Push notification pipeline. Cadence's lesson/quiz/refresher cycle. Spaced-repetition engine. Competition deadline reminders. Reminder queue.

**You edit:** timing, tone, and what actually earns an interrupt. See §04 and §05 — there are real defects in the notification code as specified.

**Done when:** your phone wakes at 08:00 with a real notification, tapping it opens Home, and the 22:00 one respects the quiet-hours rule you chose in §06.

---

## STAGE 9 — HARDEN + FINISH  *(2 days)*

**Built:** `/impeccable harden` — errors, edge cases, empty states, i18n. `/impeccable onboard` — first-run, since all six threads start empty. `/impeccable audit` — the accessibility and performance pass. `/impeccable document` — final `DESIGN.md`.

**Done when:** Lighthouse ≥90 on Performance, Accessibility, and Best Practices, on mobile. Contrast checker run on every text/background pair. Backup restore tested once, for real.

---

## THE EDITING LOOP AT EVERY STAGE

```
  I build          →  I capture desktop + mobile in one batched round
       │
       ▼
  I run the detector  →  mechanical anti-pattern findings
       │
       ▼
  Fresh reviewer   →  no access to my conversation, no inherited optimism
       │                verdict: ship / fix / rebuild / recapture
       ▼
  YOU look         →  "the bubbles are too big", "the ask copy is cold",
       │                "why is this a modal"
       ▼
  One batch of fixes  →  never a fix-per-comment drip
```

Two inspection rounds is the ceiling per stage. Anything remaining ships to the next stage's review rather than being polished forever — that is deliberate, and it is how the budget stays sane.
