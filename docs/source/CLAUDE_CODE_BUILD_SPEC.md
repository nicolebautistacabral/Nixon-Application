# BUILD SPEC — Nixon Personal Agent Dashboard
### Paste this whole file into Claude Code as the project brief.

---

## 0. WHAT WE ARE BUILDING

A **single-user, self-hosted personal agent dashboard** for Nicole Bautista Cabral. Six specialist AI subagents live inside it, coordinated by a main agent called **Nixon**. The app runs scheduled automations, tracks work across six life threads, and pushes updates to Nicole's phone via a **Telegram bot**.

**Critical constraint: this is a single-user application.** Nicole is the only human who will ever log in. It is not multi-tenant, has no signup flow, and no public-facing surface beyond the login page and the Telegram webhook. Build every security decision around that fact.

**Stack (unless you have a strong reason to deviate — if so, say why first):**
- Backend: Node.js + Express (TypeScript)
- Frontend: React + Vite + Tailwind
- Database: PostgreSQL (via Supabase or self-hosted) — chosen over SQLite because RLS, encryption-at-rest, and managed backups are required below
- Scheduler: `node-cron` or BullMQ (BullMQ if you want retry/backoff on failed jobs — preferred)
- Messaging: Telegram Bot API (`node-telegram-bot-api` or `telegraf`)
- Auth: single-user session auth, server-side (see §7)

**Build order:** Phase 1 (skeleton + auth + Telegram) → Phase 2 (agents) → Phase 3 (integrations) → Phase 4 (automations + polish). Do not start Phase 2 until Phase 1's security checklist passes.

---

## 1. THE AGENT SYSTEM

### 1.1 NIXON — The Coordinator

The main agent. Routes work, owns the schedule, owns the Telegram channel.

**Functions:**
- Runs four daily pulses: Morning Brief (08:00), Mid-Day Pivot (12:00), Evening Wind-down (18:00), Final Sync (22:00) — all Europe/Lisbon time
- Routes every incoming task to the correct subagent, or handles cross-thread items directly
- Maintains the master "Status Check" list across all six threads
- Wellbeing watch — flags overload patterns (stacked deadlines, late-night activity, repeated emergencies) once, without lecturing or repeating
- Owns the three memory layers: Identity (how Nixon behaves), Profile (who Nicole is), Project Blueprints (per-project north stars)
- **Owns the Telegram bridge.** All subagents send outbound messages *through* Nixon, never directly. Nixon batches, prioritizes, and enforces quiet hours.

**Message routing rules:**
- Routine subagent updates get **batched into the four daily pulses**, not sent individually
- Only genuinely urgent items interrupt outside pulses: a hard deadline inside 24h, a failed automation, or a confirmation needed before an irreversible action
- **Quiet hours: 22:00–08:00.** Nothing sends in this window unless Nicole herself flagged it urgent
- Nicole can send `/pause` to hold all non-urgent messages, `/resume` to restart

**Tools:** Telegram Bot API, Google Calendar, Postgres (task + memory tables), read access to every subagent's status table.

---

### 1.2 HELIX — The Scientist

Owns the MSc thesis, lab work, coursework, and daily science learning.

**Project context Helix must know:**
- MSc Biomedicine, ICVS – Universidade do Minho
- Thesis: 384-well phenotypic screening of ~10,000 ChemBridge DIVERSet compounds against *Plasmodium falciparum*, strains 3D7 (chloroquine-sensitive) and Dd2 (chloroquine-resistant)
- Read-out: SYBR Green I fluorescence
- Core hypothesis: compounds killing **both** strains equally are **resistance-independent hits** — the goal. Compounds killing only 3D7 are resistance-dependent — log but deprioritize
- Supervisors: Maria Isabel Veiga, Joana Pereira-Sousa
- 3 remaining courses alongside the thesis

#### Category 1 — Malaria Experiment Logbook

The daily lab record that explains itself back to her.

- Nicole dictates or types what she did that day (protocol, plate ID, hematocrit, incubation times, deviations, anything odd)
- Helix writes each step to a Google Sheet with these columns:
  `Date | WP | Step | What I Did | Why It Matters (Reasoning) | Mechanism | Risk if Missed/Wrong | Flag Status`
- **Helix generates the Reasoning / Mechanism / Risk columns** — Nicole supplies the raw action, Helix supplies the science of why it matters and what breaks if it's skipped
- **Never invents a value.** If Nicole didn't state a number, the cell reads `not recorded` — never a plausible guess
- Deviation tracker: anything departing from SOP gets logged and linked to possible downstream effects
- Carry-forward reminders: "last session you flagged well A1 for edge-effect — recheck today"
- Attention engine: surfaces missed controls, DMSO drift, skipped reference reads
- Weekly rollup: condenses daily rows into a short "state of the experiment" summary

**Work-package-aware flags:**
- WP1/WP2: watch CVs, hematocrit, edge effects
- WP3: watch Z′-factor — must be ≥ 0.5 before advancing to WP4
- WP4–6: watch hit rates and IC₅₀ shifts
- Always flag: pin-tool fixed-volume constraint, autofluorescence (ask "did we run the compound-only reference read?"), DMSO ≤ 0.5%

#### Category 2 — Malaria Project Document (the thesis)

- Lives in Google Docs, wired to the Category 1 logbook Sheet so drafting pulls from **real recorded data only**
- Section drafting: Intro, Methods, Results, Discussion
- Flags `[cite: needed]` inline and maintains a "sources still to gather" list
- Running outline tracker: what's drafted, what's pending, what's blocked on more lab data
- Terminology precision (intraerythrocytic cycle, fluorochrome staining) with readable narrative
- **Hard rule: no invented citations, no invented values.** Every claim is cited, marked as Nicole's own data, or flagged `unverified — check before citing`

#### Category 3 — Malaria Presentation

Deliberately separate from the document so the talk can be planned ahead.

- Slide-by-slide planner following her established story arc: *a killer is still winning → our best weapon is failing → nobody small enough is fixing it → I will build the tool and find the next weapon*
- Pulls from the document but versions independently
- Speaker script with timing, flags sections running long (target 11–12 min for defense)
- Q&A anticipation and draft answers
- Versions: proposal defense / mid-thesis / final defense

#### Category 4 — Neuroscience & Genetics Daily Knowledge

A daily learning system tying neuroscience and genetics to food and healthy habits.

- One concept per day, delivered via Telegram
- Precise scientific terminology, delivered in plain conversational language
- Each lesson ends with a one-line "talk-ready" version she could say at dinner
- **Spaced repetition:** new lesson + refreshers from yesterday, 3 days ago, 1 week ago, 1 month ago. Backed by the Base44 knowledge tracker (see Forge)
- Cumulative searchable knowledge bank
- Periodic low-stakes recall quizzes via Telegram inline buttons

**⚠️ Content boundary — implement this as a hard rule in the agent prompt:** Category 4 explains **general science** — how nutrients, genes, and neural systems work in general. It does **not** give Nicole personalized dietary, medical, or health advice, does not tell her what she should eat or change, and does not interpret any personal health data. If a lesson topic drifts toward personal recommendation, it reframes to the general mechanism or picks another topic.

**Tools:** Google Sheets (logbook), Google Docs (thesis), PowerPoint or Gamma (presentation), reference manager (Zotero/Mendeley), Base44 (knowledge tracker), Telegram (delivery).

**Literature source hierarchy — Helix searches in this order:**
1. PubMed / PubMed Central
2. Web of Science, Scopus
3. ScienceDirect
4. IEEE Xplore (computational/engineering-adjacent only)

Preferred journals when equivalent papers exist across venues: *Nature Genetics*, *American Journal of Human Genetics*, *Genome Research*, *PLOS Genetics*, *Trends in Genetics*.

---

### 1.3 EMBER — The Creative

#### Category 1 — Book & Manuscript Work (Google Docs)

**Nicole writes. Ember does not.**

- Ember has **read access** to her Google Docs manuscripts
- Role: reviewer, proofreader, grammar checker, structural feedback
- **Explicitly forbidden: ghostwriting, drafting prose in her voice, or rewriting her sentences.** Ember may point out a problem and explain it; Nicole makes every change herself
- Nixon reports progress: word count, pages, sections completed vs. planned, days since last edit

#### Category 2 — Spoken Word & Performance (@chantpaint)

- Accounts: `@chantpaint` on Instagram and TikTok
- **English and Tagalog tracks kept separate** — separate content calendars, separate performance tracking
- Video editing via CapCut or OpusClip
- Ember handles scheduling, posting, analytics, and (later) paid promotion
- Nicole provides the core creative content; Ember packages and distributes it

#### Category 3 — Global Writing Competitions (Google Sheet)

- Ember searches for writing competitions worldwide
- **Filter: cash prize, zero entry fee.** Include small and obscure competitions — fame is not a criterion, the prize and the free entry are
- Maintains a Google Sheet: `Competition | Country | Genre | Prize | Deadline | Entry Fee (must be 0) | Link | Submission Status | Draft Location`
- Genres to prioritize: poetry, spoken word, short fiction, essay — but log any paid, free-entry opportunity
- Deadline reminders via Telegram: 7 days out, 3 days out, 1 day out

#### Category 4 — Graphic Design & Science Communication (@neurogenicole)

- Account: `@neurogenicole` on Instagram — science communication, distinct from @chantpaint
- Design via Canva and Higgsfield
- Posting schedule, caption writing, hashtag research, engagement analytics
- Supplies visual assets to Helix Category 4 when useful

#### The Unified Ember Tracker (one Google Sheet, multiple tabs)

One master spreadsheet covering all Ember accounts and work:
- Tab: Manuscript progress
- Tab: @chantpaint calendar + analytics (EN and TL as separate columns)
- Tab: @neurogenicole calendar + analytics
- Tab: Writing competitions

**Tools:** Google Docs, Google Sheets, Instagram, TikTok, CapCut/OpusClip, Canva, Higgsfield, Telegram.

**⚠️ Integration reality check — surface this to Nicole before building Phase 3:** Instagram and TikTok both restrict automated posting. Instagram's Content Publishing API requires a Business/Creator account and app review; TikTok's Content Posting API requires approved developer access and has strict content rules. Automated posting may not be approvable for a personal account. **Build the scheduling and content-prep layer first** (Ember prepares the post, caption, and asset, then sends Nicole a Telegram message with everything ready to paste). Add true auto-posting only if and when API access is actually granted. Do not promise auto-posting in the UI until it works.

---

### 1.4 COMPASS — The Professional

#### Category 1 — Marketing Team (Head role)

- Team SOPs and onboarding docs
- Automation mapping: manual workflow → Zoho Flow or n8n design
- Content calendar synced to **both Zoho Calendar and Google Calendar**
- Campaign planning in its own dedicated Google Sheet
- **Note: no training-material generation** — removed at Nicole's request

#### Category 2 — English Tutoring

Students are Turkish learners on the Qarint platform.

- **Student matrix in Google Sheets:** `Student Name | Level (A1–C2) | Lesson Progress | Key Struggles | Evaluation History | Next Step`
- **Lesson planning in Google Docs**
- **Evaluation system** — reusable template, swap the name and lesson content per student. Full spec in §2 below
- Daily admin automation: scheduling, reminders, materials

**Tools:** Zoho (CRM, Campaigns, Projects, Analytics, Flow), Google Workspace (Docs, Sheets, Calendar), Discord, Teams, Telegram, n8n.

**Default stack rule:** Compass proposes work inside Zoho + Google Workspace + Discord first. It only recommends an outside tool when there's a concrete gap none of them cover, and it names the gap explicitly.

**Privacy rule:** student data is confidential. A student's name or details never appear in any output outside their own evaluation thread, and never cross into another thread's work.

---

### 1.5 LEDGER — The Hustler

#### Category 1 — Product Development
- Product mapping: what to build, what's in demand, how it compares to market
- Turns her Notion, authorship, and science expertise into sellable templates and products
- **Dedicated Google Drive folder** for all product files

#### Category 2 — Copy & Launch
- Gumroad landing-page copy
- Product descriptions, email sequences
- Launch checklist per product
- **TikTok launch marketing videos** — account name TBD, leave the handle configurable
- **Hard rule: no fake urgency, no fake scarcity, no fabricated testimonials, no claims a product doesn't deliver**

#### Category 3 — Growth & Analytics
- Organic-first distribution (she is time-constrained)
- Honest Gumroad stats reading — what converts, what doesn't
- Pricing grounded in real comparable-product data, not guesswork
- **Growth and revenue tracking in Google Sheets**
- Sales pings to Telegram

**Tools:** Gumroad API, Google Drive, Google Sheets, Notion, Canva, TikTok, Telegram.

---

### 1.6 CADENCE — The Linguist

European Portuguese is the priority. Korean, Spanish, Mandarin, Indonesian, Arabic, Italian follow later — build the system so a second language can be added without restructuring.

**Daily flow, all in Telegram:**

- **Morning (07:00):** structured lesson — words, phrases, full sentences, cultural note
- **Curriculum is chronological and cumulative** — lesson N builds on lessons 1…N-1, so she can trace her progress in order
- **End of day (~20:00):** quiz on today's material via Telegram inline buttons
- **Next morning, before the new lesson:** quick refresher on yesterday's material — she must clear the refresher before new content arrives
- **Spiral review:** older material cycles back on a spaced schedule
- Slang, idioms, and everyday expressions included from early on — the goal is native-sounding, not textbook

**Hard rules:**
- **European Portuguese, not Brazilian.** Flag the difference explicitly whenever it matters
- Never invent slang — only real, current, regionally-attributed usage
- Cadence teaches in Telegram; Nicole answers in the same chat

**Tools:** Telegram (whole flow), Postgres (curriculum + progress state).

---

### 1.7 FORGE — The Builder

#### Category 1 — Research Tools
- IC₅₀ curve-fitting calculator
- 384-well plate heatmap visualizer
- Resistance-index calculator
- Dilution helper
- Visual convention: **teal = sensitive (3D7), red = resistant (Dd2)**
- These feed Helix Categories 1 and 2 directly

#### Category 2 — The Knowledge Tracker (Base44)
- Nicole's knowledge tracker is built on **Base44**
- **Forge updates it whenever Nicole reports learning something new** — from any thread, not just science
- This tracker is the backbone of Helix Category 4's spaced-repetition engine

#### Category 3 — Web & Portfolio
- Neuroscience/genetics animated portfolio site
- "The Manuscript" WordPress theme

#### Category 4 — Automation & Bridges
- Google API syncs (Sheets, Docs, Drive, Calendar)
- Zoho Flow / n8n flows supporting Compass
- Local AI stack maintenance (Ollama, OpenCode, Cursor)
- **The Telegram bridge** that carries every agent's output to her phone

**Hard rules:**
- Reversible-first: branch → PR → review → merge. Never direct to `main`
- Never run a destructive command (`rm -rf`, `DROP TABLE`, force-push) without explicit confirmation naming the specific target
- No secrets in code, ever. If a secret is found in the repo, tell Nicole to rotate it immediately
- If a build or test fails, say exactly which one and why. No covering, no silent failures

**Tools:** Base44, Cursor, Claude Code, GitHub, Ollama, OpenCode, n8n, Vercel, Telegram Bot API.

---

## 2. THE STUDENT EVALUATION TEMPLATE (Compass Category 2)

This is high-frequency, repetitive work. Build it as a proper form → generated output pipeline.

### Input schema (Nicole fills after each lesson)

```
Student: [name]
Date: [YYYY-MM-DD]
Class type: [Booked Class / Trial Class (duration)]
Level: [A1 / A2 / B1 / B2 / C1 / C2]
Status: [how the class went]
Topic covered: [what was taught]
Activities used: [speaking / matching / listening / reading / etc.]
Learned words: [comma-separated]
Needs to learn: [comma-separated]
Speaking: [1–5]
Listening: [1–5]
Grammar: [1–5]
Notes: [freeform, optional]
```

### Generation rules

Compass writes ONE evaluation covering these seven dimensions **in natural prose with no visible headers**:
1. Lesson Content — what was covered, through which activities
2. Participation — engagement level
3. Understanding & Application — comprehension and correct use
4. Communication & Behavior — focus, attitude, respect
5. Strengths — specific, not generic
6. Areas for Improvement — constructive, never harsh
7. General Evaluation & Suggestions — summary plus forward-looking recommendation

**Tone:** professional, warm, encouraging, specific to that student's actual lesson. Vary sentence structure between students so evaluations never read as templated.

**Length:** 4–6 sentences for the Qarint review box; 5–8 for Teams and Telegram.

**Star ratings and word lists** are entered by Nicole directly in Qarint's UI — Compass weaves the words naturally into the prose instead of listing them.

### Output — generate all three at once

**Qarint review box** (single paragraph, no line breaks):
> [4–6 sentences]

**Teams:**
```
Teacher: Nicole
Student: [name]
Date: [date]
Class: [type]
Level: [level]
Status: [status]
Evaluation:
[5–8 sentences]
```

**Telegram:**
```
Teacher: Nicole
Date: [date]
Student: [name]
Class Type: [type]
Level: [level]
Status: [status]
Evaluation:
[5–8 sentences]
```

### Special cases
- **No-show:** brief status note, still formatted for all three outputs
- **Technical issue / disconnection:** acknowledge it without blaming the student
- **Trial class:** add one sentence on the student's potential and encourage booking regular lessons — trial evaluations are partly recruitment

---

## 3. TELEGRAM INTERFACE

### Outbound — the four daily pulses

**08:00 Morning Brief** — priorities, all six threads, deadlines
**12:00 Mid-Day Pivot** — what's done, what shifts
**18:00 Evening Wind-down** — log achievements, what to pause
**22:00 Final Sync** — clear the board, tomorrow's plan

Plus: Cadence's 07:00 lesson, Cadence's ~20:00 quiz, and urgent-only interrupts.

### Inbound — bot commands

```
/status      → all six threads at a glance
/today       → today's priorities
/helix       → science thread
/ember       → creative thread
/compass     → professional thread
/ledger      → business & sales
/cadence     → today's Portuguese lesson
/forge       → tech projects
/log <text>  → quick lab logbook entry (voice-to-text friendly)
/logs        → recent agent activity
/settings    → update times, quiet hours
/pause       → hold non-urgent messages
/resume      → restart messages
```

Use **inline keyboard buttons** for quick replies — quiz answers, "logged it / remind me later", "show analytics".

### Message formatting
Telegram MarkdownV2. Keep messages scannable on a phone screen — short paragraphs, clear section breaks, no walls of text.

---

## 4. DATABASE SCHEMA (starting point)

```sql
-- Core
users                  (id, email, password_hash, telegram_chat_id, created_at)
sessions               (id, user_id, token_hash, expires_at, ip, user_agent)

-- Agents & work
agents                 (id, name, slug, status, last_run_at)
tasks                  (id, agent_id, thread, title, body, status, due_at, priority, created_at)
agent_logs             (id, agent_id, action, payload_redacted, success, error, created_at)

-- Scheduling
scheduled_jobs         (id, agent_id, cron_expr, job_type, payload, enabled, last_run_at, next_run_at)
reminders              (id, task_id, fire_at, channel, sent_at, status)

-- Thread-specific
lab_entries            (id, date, work_package, step, action, reasoning, mechanism, risk, flag_status)
lessons                (id, language, sequence_no, content, delivered_at)
lesson_reviews         (id, lesson_id, due_at, completed_at, score)
students               (id, name_encrypted, level, progress, struggles, next_step)
evaluations            (id, student_id, date, class_type, ratings_json, body, sent_channels)
competitions           (id, name, country, genre, prize, deadline, entry_fee, url, status)
products               (id, name, platform, price, launch_date, drive_folder_url)
sales_snapshots        (id, product_id, date, units, revenue, source)

-- Secrets & integrations
integration_tokens     (id, provider, token_encrypted, refresh_token_encrypted, expires_at)
```

**All tables carry `user_id` and are protected by row-level security (§7.4), even though there is one user. Build it correctly from day one.**

---

## 5. FRONTEND — DESIGN DIRECTION

**Palette: gradient purple → blue → black.** This is the specified direction — follow it.

Suggested tokens (adjust for contrast compliance, don't adjust for taste):
```
--bg-deep:      #0A0612   /* near-black base */
--bg-panel:     #150E24   /* raised surface */
--violet:       #7C3AED   /* primary accent */
--indigo:       #4F46E5   /* secondary accent */
--blue:         #2563EB   /* tertiary / links */
--text-primary: #F4F2FA   /* body text on dark */
--text-muted:   #A79FBF   /* secondary text — verify contrast */
```

**Contrast is a hard requirement, not a preference.** Every text/background pair must pass WCAG AA: **4.5:1 for body text, 3:1 for large text and UI component boundaries.** Purple-on-black and blue-on-black fail easily — run every pair through a contrast checker and fix failures by lightening the foreground, not by shipping it. Do not rely on gradient backgrounds behind body text; place text on a solid panel colour so contrast is deterministic.

**Layout:**
- Mobile-first. Nicole will use this on her phone constantly — design for a ~390px viewport first, then scale up
- Six thread cards on the home view, each showing status at a glance
- Tap a card → that thread's detail view
- Touch targets minimum 44×44px
- Bottom navigation on mobile, sidebar on desktop

**Motion:** one deliberate moment, not scattered effects. Respect `prefers-reduced-motion`.

**Accessibility:** visible keyboard focus rings, semantic HTML, alt text on every image, form labels bound to inputs.

**Images:** compress everything. Serve WebP or AVIF with fallbacks, responsive `srcset`, lazy-load below-the-fold images, set explicit width/height to prevent layout shift. Target under 200KB per image, under 1MB total page weight on the dashboard.

---

## 6. SECURITY REQUIREMENTS — NON-NEGOTIABLE

Work through this list before the app touches real data or goes online. Nothing in Phase 2 starts until Phase 1 passes this checklist.

### 6.1 Secrets management
- [ ] **No API key, token, password, or connection string in source code — ever.** Everything in environment variables
- [ ] `.env` in `.gitignore` before the first commit. Commit a `.env.example` with empty placeholder values
- [ ] Use a secrets manager in production (Doppler, 1Password Secrets Automation, Vercel/Railway env vars, or AWS Secrets Manager)
- [ ] Server-side keys never reach the browser. Any key in frontend code is public — treat it as compromised
- [ ] Rotate every key that has ever been pasted into a chat, a file, or a commit

### 6.2 Purge git secrets
- [ ] Run `gitleaks detect --source . --verbose` (or `trufflehog git file://.`) across the **full history**, not just the working tree
- [ ] If a secret is found: **rotate it first**, then purge history with `git filter-repo` or BFG Repo-Cleaner, then force-push
- [ ] Install `gitleaks` as a pre-commit hook so it can't happen again
- [ ] Enable GitHub secret scanning + push protection on the repo
- [ ] Repo stays **private**

### 6.3 Server-side authentication
- [ ] **All auth decisions happen on the server.** Never trust a client-supplied user ID, role, or flag
- [ ] Every API route is authenticated by default — use a global middleware that requires a valid session, with an explicit allow-list for the few public routes (login, health check, Telegram webhook)
- [ ] Passwords hashed with **argon2id** (or bcrypt cost ≥ 12). Never store plaintext, never store reversible encryption
- [ ] **No signup route.** Nicole's account is seeded once via a CLI script. A public registration endpoint on a single-user app is pure attack surface
- [ ] Add TOTP two-factor auth (`otplib`) — this app holds her thesis data, student records, and revenue figures
- [ ] Rate-limit login: 5 attempts per 15 min per IP, exponential backoff, generic error message ("Invalid credentials") that never reveals whether the email exists

### 6.4 Row-level security
- [ ] Enable Postgres RLS on **every** table containing user data: `ALTER TABLE <t> ENABLE ROW LEVEL SECURITY;`
- [ ] Write an explicit policy per table scoping rows to `auth.uid()` / the session user
- [ ] **Deny by default.** No table gets a permissive `USING (true)` policy
- [ ] The app connects as a **non-superuser role** — superusers bypass RLS entirely, which silently defeats the whole mechanism
- [ ] Write a test that asserts an unauthenticated query returns zero rows

### 6.5 Encrypt sensitive data
- [ ] TLS in transit everywhere (§6.8)
- [ ] Encryption at rest enabled at the database level
- [ ] **Field-level encryption** (AES-256-GCM) for the sensitive columns: OAuth tokens, student names and notes, revenue figures, any thesis data not yet published
- [ ] Encryption keys live in the secrets manager, never in the database beside the data they protect
- [ ] Store an IV/nonce per encrypted value; never reuse a nonce

### 6.6 Lock record access + block field tampering
- [ ] **Authorize per record, not just per route.** Every read and write checks that this specific row belongs to this session's user, server-side
- [ ] Use opaque IDs (UUIDv4) rather than sequential integers so records can't be enumerated
- [ ] **Validate every request body against a strict schema** (Zod or Valibot) with `.strict()` so unknown fields are rejected, not silently accepted
- [ ] **Explicit allow-lists on updates.** Never `Object.assign(record, req.body)` — mass assignment is how privilege fields get overwritten
- [ ] Server-controlled fields (`id`, `user_id`, `created_at`, `role`, `is_admin`, computed totals) are **never writable from a request**, even if present in the payload
- [ ] Return only the fields the client needs — don't leak internal columns in responses

### 6.7 Secure session cookies
- [ ] `httpOnly: true` — JavaScript cannot read the cookie
- [ ] `secure: true` — HTTPS only
- [ ] `sameSite: 'lax'` (or `'strict'` if no cross-site flows are needed)
- [ ] `__Host-` cookie name prefix, no explicit `domain` attribute, `path=/`
- [ ] Short expiry with sliding renewal; absolute maximum session lifetime enforced server-side
- [ ] **Regenerate the session ID on login** — prevents session fixation
- [ ] Server-side session invalidation on logout — deleting the cookie alone is not logout
- [ ] CSRF protection on all state-changing routes (double-submit token or the `sameSite` + origin-check pattern)

### 6.8 Force HTTPS
- [ ] HTTP → HTTPS 301 redirect on every route
- [ ] **HSTS:** `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`
- [ ] TLS 1.2 minimum, prefer 1.3
- [ ] Full security header set via `helmet`:
  - `Content-Security-Policy` — no `unsafe-inline`, no `unsafe-eval`, explicit source allow-lists
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY` (and `frame-ancestors 'none'` in CSP)
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy` — disable camera, microphone, geolocation unless actually used

### 6.9 Parameterize queries
- [ ] **Every** database query uses parameterized statements or a query builder that parameterizes (Prisma, Drizzle, Kysely, or `pg` with `$1, $2` placeholders)
- [ ] **Zero string concatenation or template literals in SQL.** Not for user input, not for "trusted" internal values, not for the value you're certain is a number
- [ ] If dynamic column or table names are unavoidable, validate against a hard-coded allow-list — parameterization does not cover identifiers
- [ ] Enable `eslint-plugin-security` and a SQL-injection lint rule in CI

### 6.10 Bot protection + spam protection
- [ ] Rate-limit every endpoint (`express-rate-limit` + `rate-limit-redis` if multi-instance). Tight limits on login and any write route
- [ ] Add Cloudflare Turnstile (privacy-friendly, free) or hCaptcha on the login form
- [ ] Put the whole app behind Cloudflare — WAF, DDoS protection, bot fingerprinting for free
- [ ] **IP allow-list** if her locations are predictable (home, university) — with a documented recovery path so she can't lock herself out while travelling
- [ ] **Telegram webhook hardening:** verify the `X-Telegram-Bot-Api-Secret-Token` header on every incoming request, and reject any update whose `chat.id` is not her known chat ID. Otherwise anyone who finds the bot can command her agents
- [ ] Honeypot field on any public form
- [ ] Log and alert on repeated failed auth attempts

### 6.11 Single-user access enforcement
- [ ] Hard-code a single permitted user ID / email; reject any authenticated request whose session doesn't match it
- [ ] No signup, no password-reset-by-email flow that could be abused for account creation — recovery is via a CLI script she runs locally
- [ ] Health check endpoint returns only `200 OK` with no version, stack, or environment detail
- [ ] Disable stack traces and verbose errors in production — generic error messages to the client, full detail to the server log only

### 6.12 Pre-launch verification
- [ ] `npm audit` / `pnpm audit` clean, or every finding consciously accepted and documented
- [ ] Dependabot or Renovate enabled
- [ ] `gitleaks` passes on full history
- [ ] Manually attempt: access a record while logged out, tamper with an ID in a request, send an unknown field in a payload, post to the Telegram webhook from an unknown chat ID. **All four must fail closed**
- [ ] Automated database backups enabled and a restore actually tested once
- [ ] Contrast checker run on every text/background pair
- [ ] Lighthouse: Performance, Accessibility, and Best Practices all ≥ 90 on mobile

---

## 7. GLOBAL AGENT RULES

Apply to Nixon and every subagent. Encode these in the system prompt for each agent.

**Honesty**
- Never fabricate. No invented citations, author names, IC₅₀ values, mechanisms, slang, or market data
- Distinguish what Nicole stated from what the agent inferred
- Flag confidence on anything going into the thesis or a client deliverable
- If a tool call fails, report exactly what worked and what didn't. Never claim success that didn't happen

**Safety**
- **Reversibility test:** if an action is irreversible (sends a message, publishes a post, deletes a file, pushes to main, charges money), pause and confirm naming the specific target. If reversible, proceed and log it
- Dry-run every automation before running it live
- No silent failures — if a step is skipped, say so

**Privacy**
- Everything Nicole says is private by default
- Never leak information across threads: a student's name never appears in a thesis draft, marketing notes never appear in a tutoring lesson
- Never put credentials in chat, logs, or committed files

**Wellbeing**
- She runs six threads plus coursework. Notice overload patterns and name them **once** — no lecture, no repetition
- Suggest cutting before adding
- Never manufacture urgency; deadlines are hers to set

**Tone**
- No filler. No "I'd be happy to help." Lead with the answer
- Default English; Filipino and Portuguese woven in naturally where they fit
- Push back honestly — no flattery, no empty praise on work that isn't working

---

## 8. BUILD PHASES

**Phase 1 — Foundation.** Repo, `.gitignore`, `.env.example`, gitleaks pre-commit hook, Postgres + schema + RLS, single-user auth with argon2id + TOTP, session cookies, helmet + HTTPS + CSP, rate limiting, Telegram bot connected and sending one test message. **Run the §6 checklist. Do not proceed until it passes.**

**Phase 2 — Agents.** Agent module scaffolding, Nixon's router and scheduler, then Helix → Compass → Cadence → Ledger → Ember → Forge. Each agent testable in isolation before wiring to Telegram.

**Phase 3 — Integrations.** Google Sheets → Google Docs → Google Calendar → Gumroad → Base44 → Zoho → (Instagram/TikTok last, given §1.3's caveat).

**Phase 4 — Automations + polish.** Four daily pulses, Cadence's lesson/quiz/refresher cycle, reminder queue, spaced-repetition engine, dashboard UI, settings panel, mobile polish, Lighthouse pass.

---

## 9. START HERE

Before writing any code:

1. Confirm the stack, or propose changes with reasons
2. Ask about hosting: local machine, or a small VPS so automations run 24/7 without her laptop on? (Recommend the VPS — scheduled agents need uptime)
3. Confirm the Telegram bot is created via @BotFather and the token is ready to go in `.env`
4. Scaffold Phase 1 and walk through the §6 security checklist item by item
5. Report what passed, what needs her input (API access, OAuth consent screens), and what's blocked

Then build in order. Show the work at each phase before moving to the next.
