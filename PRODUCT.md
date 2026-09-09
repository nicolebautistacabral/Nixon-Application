# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Confirmed by the user. Frontend: React + Vite + Tailwind. Backend: Node.js + Express (TypeScript). Database: Supabase (hosted PostgreSQL, row-level security). Push: Firebase Cloud Messaging. Auth: single-user server-side session auth, argon2id + TOTP.

**The system is workflows only. There is no user interface.** n8n Cloud (2.x) is the whole runtime: scheduled triggers, external integrations, Telegram send and receive, the seven agents as AI Agent workflows, and the human-in-the-loop gates the autonomy protocol requires. Postgres holds the source of truth. A dedicated Google Calendar carries both the plan and the record of work. A Google Sheet mirrors the board for reading. Telegram is the only conversation surface. BullMQ and Redis are removed; n8n provides scheduling, retry, and backoff. The design is recorded in `docs/09_WORKFLOW_SYSTEM.md`.

A React dashboard is **deferred, not cancelled**: the schema carries `user_id` throughout and agent logic sits behind callable workflows, so one can be added later without rework.

Hosting: **n8n Cloud**, with Postgres on Supabase. Being always on, it removes the earlier constraint that scheduled automations could only fire while a local machine was awake. `docker-compose.yml` remains in the repository for optional local development only.

## Users

One user, exclusively: Nicole Bautista Cabral. There is no second audience, no signup, no multi-tenancy, and no public surface beyond the login page and the Telegram webhook.

She is an MSc Biomedicine student at ICVS, Universidade do Minho, running six parallel commitments at once: a malaria thesis with wet-lab work, three remaining courses, a marketing team she heads, English tutoring on the Qarint platform, a creative writing and spoken-word practice across two social accounts, a small digital-product business, and daily European Portuguese study.

Her situation is time-scarcity, not capability-scarcity. She uses this on a phone, in fragments, between other obligations — in a lab, in a meeting, on a commute. The job she is doing is offloading coordination so that context-switching between six threads does not cost her the thread she is currently in.

## Product Purpose

Nixon is her external brain. Six specialist agents (Helix, Ember, Compass, Ledger, Cadence, Forge) coordinated by a seventh (Nixon) that owns routing, scheduling, and the single outbound channel to her phone.

The operating principle the whole system serves: **she gives one instruction, and the system decomposes it, executes it, and reports back — without her re-prompting.** It never runs blind and never puts her data at risk.

Success is measured by what she does not have to do: she does not re-explain context, does not chase a deadline she was not warned about, does not answer the same clarifying question twice, and does not lose a lab observation because she was holding a pipette when she thought of it.

## Positioning

A single-user personal agent system built around one person's actual six threads, with the domain knowledge of those threads encoded rather than prompted. The malaria screening protocol, the European-Portuguese-not-Brazilian rule, the student evaluation format for one specific platform, the resistance-independent-hit hypothesis — these are product facts, not configuration. A general-purpose assistant cannot hold them, and a multi-tenant product could not justify encoding them.

## Operating Context

- **Timezone: Europe/Lisbon** for every schedule, deadline, and log entry, year-round, including the summer offset.
- **Primary surface is a phone**, roughly 390px wide, used in short bursts. Desktop is secondary.
- **Telegram is a permanent peer channel**, not a fallback, because iOS web push requires iOS 16.4+ and Home-Screen installation and cannot be relied on alone.
- **Four daily pulses** structure the day: 08:00 Morning Brief, 12:00 Mid-Day Pivot, 18:00 Evening Wind-down, 21:30 Final Sync. Quiet hours 22:00–08:00.
- Work products live in external systems she already uses: Google Sheets, Google Docs, Google Drive, Google Calendar, Zoho, Gumroad, Base44, Instagram, TikTok, Canva, Qarint, Microsoft Teams.
- **The lab logbook is dictated**, often by voice, often one-handed, often mid-protocol.

## Capabilities and Constraints

**The seven agents and their scope**

- **Nixon** — routing, the four pulses, the Telegram and push bridge, the Status Check master list, quiet-hours enforcement, overload watch. All subagent output flows through Nixon; no subagent messages her directly.
- **Helix** — malaria experiment logbook, thesis document, defense presentation, daily neuroscience and genetics learning.
- **Ember** — manuscript review, spoken word (@chantpaint, English and Tagalog tracked separately), global writing competitions, science communication (@neurogenicole).
- **Compass** — marketing team leadership, English tutoring including the student evaluation pipeline.
- **Ledger** — product development, launch copy, growth and revenue tracking.
- **Cadence** — European Portuguese daily lesson, quiz, and spiral review.
- **Forge** — research tools, the Base44 knowledge tracker, web and portfolio work, automations and bridges.

**Hard behavioural constraints**

- **Never invent.** No fabricated citations, author names, IC₅₀ values, mechanisms, slang, or market data. An unstated value is recorded as `not recorded`, never as a plausible guess.
- **Reversibility gate.** Any irreversible action — sending, publishing, deleting, pushing to `main`, charging money — pauses and confirms, naming the specific target. Reversible actions proceed and are logged.
- **Ember does not write.** Read access to manuscripts, review and structural feedback only. Ghostwriting, drafting prose in her voice, and rewriting her sentences are forbidden. She makes every change herself.
- **Helix Category 4 is general science only.** No personalised dietary, medical, or health advice; no interpretation of her personal health data. A topic drifting toward personal recommendation is reframed to the general mechanism or replaced.
- **Cadence teaches European Portuguese, not Brazilian**, and flags the difference explicitly whenever it matters. Slang must be real, current, and regionally attributed.
- **Student data never crosses threads.** A student's name or details appear only within their own evaluation thread.
- **No thread leakage generally.** Marketing notes do not appear in a tutoring lesson; a student name does not appear in a thesis draft.
- **Ask once, bundled.** Clarification is a single bundled question, never a drip. Default is to infer from context and state the inference.
- **Standing instructions outrank vague current ones.** A past explicit boundary is not overridden by an ambiguous present request.
- **Language is a column, not a fork.** Portuguese is first; Korean, Spanish, Mandarin, Indonesian, Arabic, and Italian must be addable without restructuring.

**Technical constraints**

- Single user, enforced server-side: a hard-coded permitted identity, rejecting any authenticated request that does not match.
- No signup route and no email password reset. Account seeding and recovery are local CLI scripts.
- Row-level security on every table carrying user data, deny by default, with the application connecting as a non-superuser role.
- Field-level AES-256-GCM encryption on OAuth tokens, student names and notes, revenue figures, and unpublished thesis data.
- Every database query parameterised. No string concatenation in SQL.
- Automated posting to Instagram and TikTok is **not assumed to be available.** Instagram's Content Publishing API requires a Business/Creator account and app review; TikTok's Content Posting API requires approved developer access. The content-preparation layer is built first and auto-posting is not shown in the interface until it demonstrably works.

## Brand Commitments

- **The name is Nixon.** Subtitle: "Nicole's Polymath Assistant".
- **The wordmark is an existing designed asset** — a script capital `N` with a swash underlining `IXON` set in geometric sans capitals. It ships as artwork and is not re-cut in a web font by any later pass.
- **The visual world is pinned by a user-supplied reference image**: a saturated blue-to-violet-to-magenta gradient ground, six iridescent soap-film spheres carrying the six specialist agents, a dimensional brain as the Nixon centre, and a five-block pastel bottom navigation. This world is binding and is not to be re-derived, re-themed, or reinterpreted.
- **Tone:** no filler, no "I'd be happy to help", lead with the answer. Push back honestly; no flattery and no empty praise on work that is not working. Default English, with Filipino and Portuguese woven in naturally where they fit.
- **Never manufacture urgency.** Deadlines are hers to set.
- **Notice overload once.** Name the pattern, without lecturing and without repeating.

## Evidence on Hand

- `docs/source/CLAUDE_CODE_BUILD_SPEC.md` — the technical specification: agent functions, the student evaluation template, the Telegram interface, database schema, the security checklist, global agent rules, build phases.
- `docs/source/CLAUDE_CODE_MASTER_PROMPT_REVISED.md` — the inference-versus-ask protocol, push notification requirements, the agent function summary.
- `docs/source/PUSH_NOTIFICATION_IMPLEMENTATION.md` — Firebase Cloud Messaging integration. **Contains nine identified defects, three of them fatal, documented in `docs/05_IMPROVEMENTS_AND_CORRECTIONS.md`. It is a starting point, not a correct implementation.**
- `docs/source/README_START_HERE.md` — the original package index.
- The user-supplied reference image is the pinned visual brief and the approved composition for the desktop first viewport.
- A React prototype, `NixonDashboard.jsx`, is referenced by the source documents but **has not been supplied to this project and does not exist in the repository.** No later work may cite it as an authority.

**Absences that must not be fabricated:** there are no users other than Nicole, no testimonials, no revenue history, no benchmark data, no completed thesis results, and no granted Instagram or TikTok API access. None of these may be invented to fill a layout.

## Product Principles

1. **One instruction, then silence until it is done.** Every clarifying question the system asks is a failure it should have avoided by inference. Ask only when a wrong guess would be unsafe or irreversible.
2. **Honesty over reassurance.** A failed tool call is reported as failed, naming what worked and what did not. Confidence is flagged on anything entering the thesis or a client deliverable.
3. **The threads must not touch.** Six lives run in parallel and their data stays separated by default, not by diligence.
4. **Nothing is remembered by accident and nothing is forgotten by accident.** What she says is captured; what the system concludes from it is visible to her and reversible.
5. **Suggest cutting before adding.** She is at capacity. A feature that adds a decision to her day has to justify itself against that.

## Accessibility & Inclusion

WCAG 2.1 AA is a hard requirement, not a preference, and applies to the pinned visual world rather than being waived by it.

- Body text ≥4.5:1, large text and UI component boundaries ≥3:1, verified with a contrast checker on every pair rather than by eye.
- Text is never placed on the gradient where the effective contrast varies; it sits on a solid, deterministic surface.
- Touch targets ≥44×44px throughout, designed at 390px first.
- Visible keyboard focus rings, semantic HTML, form labels bound to inputs, alt text on every image.
- `prefers-reduced-motion` is honoured with an intentional reduced alternative, not a blanket disabling of feedback.
- Lighthouse ≥90 on Performance, Accessibility, and Best Practices, measured on mobile.
