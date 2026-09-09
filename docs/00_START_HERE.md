# NIXON — UPDATED BUILD PACKAGE
### Read this first. It replaces `README_START_HERE.md` as the index.

**Status:** Scope narrowed to **workflows only** — no interface. See `09`, which is now the live plan. Schema written and tested; runtime stack ready.
**Branch:** `claude/impeccable-design-system-je3mcw`
**Date:** 2026-09-09

---

## WHAT CHANGED FROM YOUR ORIGINAL FOUR DOCUMENTS

Your four documents (`CLAUDE_CODE_BUILD_SPEC.md`, `CLAUDE_CODE_MASTER_PROMPT_REVISED.md`, `PUSH_NOTIFICATION_IMPLEMENTATION.md`, `README_START_HERE.md`) remain the constitution. Nothing in them is deleted. This package does four things they did not:

1. **Adds the design method.** Your originals specified *what colours to use*. They did not specify *how to arrive at a design that does not look AI-generated*. That is what Impeccable provides, and §01 documents exactly how to drive it.
2. **Resolves three spec conflicts** your documents contain (palette, notification priority, and the Home-screen hero). §05 lists them. **Two of them need your decision before any code is written.**
3. **Corrects nine real defects** in the push-notification implementation guide. Some of it does not run as written. §05 lists each with the fix.
4. **Breaks the work into sections and functions** you can approve or edit one at a time, rather than approving a 600-line spec in one gulp. §03 and §04.

---

## THE DOCUMENTS IN THIS PACKAGE

| File | What it answers |
|---|---|
| `00_START_HERE.md` | This index. What changed, what needs your input. |
| `01_IMPECCABLE_WORKFLOW.md` | Every skill/command to employ, in order. How `PRODUCT.md` and `DESIGN.md` actually work — including why `DESIGN.md` is written **last**, not first. |
| `02_DESIGN_DIRECTION.md` | Typography, colour, layout, and the 3D/material plan. How your reference image becomes the built thing. The anti-generic rules. |
| `03_SECTION_BY_SECTION.md` | Screen by screen, in build order. What you edit at each stage. |
| `04_AGENT_FUNCTIONS.md` | Function by function per agent. Input → processing → expected output → automation trigger. |
| `05_IMPROVEMENTS_AND_CORRECTIONS.md` | Design and engineering improvements. Spec conflicts. Defects in the existing code samples. |
| `06_DECISIONS_I_NEED_FROM_YOU.md` | The decision list. **Answered — see below.** |
| `07_MEMORY_AND_BOARD.md` | The two requirements you added: chatbox memory, and the per-agent board. |
| `08_N8N_ARCHITECTURE.md` | The n8n assessment and the Wait-node findings. Superseded on scope by `09`. |
| `09_WORKFLOW_SYSTEM.md` | **THE LIVE PLAN.** Workflows only, Calendar as the spine. 25 workflows, the digest spec, build order. |

**Dormant** — the dashboard is deferred, not cancelled: `02_DESIGN_DIRECTION.md`, `03_SECTION_BY_SECTION.md`, and the UI layout in `07` Part 2. The memory design in `07` Part 1 and the schema in Part 2 are both live.

---

## THE ORDER OF OPERATIONS (high level)

```
  YOU ANSWER §06              ✓ done
        │
        ▼
  Install Impeccable          ✓ done — v4.0.0, from source
        │
        ▼
  /impeccable init            ✓ done — PRODUCT.md written and verified
        │
        ▼
  Direction round             →  Impeccable deals visual directions; you lock one
        │                         your reference image is a PINNED BRIEF here —
        │                         it beats the roll, always
        ▼
  Phase 1: Foundation         →  auth, DB, security checklist  (§6 of Build Spec)
        │
        ▼
  Phase 2: Agents             →  the seven agents, testable in isolation
        │
        ▼
  Phase 3: Integrations       →  Google, Gumroad, Base44, Zoho
        │
        ▼
  Phase 4: Automations + UI   →  pulses, push, the dashboard you can see
        │
        ▼
  /impeccable document        →  writes DESIGN.md from the BUILT world
```

**The thing most people get wrong, and the thing your original package got wrong:** `DESIGN.md` is not a brief you write up front and then implement. Impeccable writes it at the *end*, from the interface that actually exists. A design rulebook written before the build gets defended against reality instead of describing it. §01 covers this in full.

---

## DECISIONS LOCKED  *(2026-09-09)*

| # | Decision | Answer |
|---|---|---|
| 1 | Palette | **(a)** The reference image. Drenched on Home, restrained on working screens. |
| 2 | Hosting | **Local**, for zero cost. Supabase for Postgres. Redis yes. ← *see constraint 1 below* |
| 3 | Home screen | **(a)** The bubbles ARE the working Home. Size = open items. |
| 4 | Pulses vs quiet hours | **(b)** Pulses respect quiet hours. **Final Sync moves 22:00 → 21:30.** |
| 5 | 3D depth | Default: WebGL hero, raster bubbles, CSS elsewhere. ← *see constraint 2* |
| 6 | Typography | Default: wordmark as SVG asset, Geist for UI, Geist Mono for code/measurements. |
| 7 | Bubble size | **Open items** — now defined as `todo + in_progress + blocked` per agent (§07 §2.7). |
| 8 | Overload watch | Default: 3+ deadlines in 48h, or post-23:00 activity 3 days running, or 4 deferrals. |
| 9 | First integration | Default: Google Sheets. |
| — | Improvements C-1…C-15 | **All accepted.** |
| — | Added | Chatbox memory layer + per-agent board. Specced in `07`. |

---

## THREE CONSTRAINTS DISCOVERED DURING SETUP

These are real and they change things. None are blocking, but you should know about them.

### Constraint 1 — Local hosting means the automations do not fire

This is the important one. You chose local to avoid cost, which is reasonable. The consequence is not: **if the machine is asleep at 08:00, there is no Morning Brief.** Same for the 07:00 Portuguese lesson, the 20:00 quiz, the competition deadline warnings, and the quiet-hours queue flush at 08:00. The automation layer is most of why this system exists, and on a laptop it runs only while the lid is open.

**There is a free fix, and you are already half-way to it.** Split the work by what it actually needs:

```
  ALWAYS-ON  (Supabase — free tier, already in your stack)
  ├─ the four daily pulses          these only READ the database
  ├─ Cadence 07:00 lesson, 20:00 quiz    and SEND a notification.
  ├─ competition deadline reminders      No reasoning required.
  └─ quiet-hours queue flush

  LOCAL  (your machine, when it is on)
  ├─ agent reasoning and drafting
  ├─ Google Sheets / Docs / Calendar syncs
  └─ anything that needs to think
```

Supabase's free tier includes `pg_cron` and Edge Functions. An Edge Function can call the Firebase and Telegram HTTP APIs directly. Your Morning Brief is a database read — *"3 priorities today"* — not a reasoning task, so it does not need your laptop. Cost: nothing.

I have not verified the current free-tier limits or the inactivity-pause policy against Supabase's live documentation, so treat the specifics as needing a check before we rely on them. The architecture holds regardless of where the always-on piece runs.

Two alternatives if you would rather not put logic in Supabase: a GitHub Actions scheduled workflow (free minutes are ample for a daily job, but cron timing is best-effort and can drift 10+ minutes), or Oracle Cloud's Always Free tier, which is a genuinely free always-on VM but requires a card for identity verification and often has no ARM capacity in popular regions.

**Decision needed:** Supabase Edge Functions for the always-on layer, or accept that automations only fire while your machine is awake?

### Constraint 2 — No image generation in this environment

`impeccable context` reports no image generator and no image converter available here. That affects the build in two specific ways:

**Good news first:** your reference image *is* the approved comp. Impeccable's `build-phase start --comp <file>` takes an existing image and skips comp generation entirely — then the whole measured gate applies to matching *your* picture: region boxes measured off it, type ranked against its actual cap heights, and a hero diff that must score ≥72% before the build advances. That is precisely the "how does my reference become exactly how it looks" mechanism, and it works without any generation.

**The gap:** the brain and the six bubbles are raster *plates* that normally get generated at asset resolution. Without a generator, they must come from somewhere. Options: you supply them (if you have the source file for that image at higher resolution, that solves it outright), we source them, or we build the bubbles procedurally in WebGL and skip the raster path for those. **Do you have the original of that image, or the assets that went into it?**

### Constraint 3 — Your reference is landscape; the app is mobile-first

The image is a 1920×1080 desktop composition. Your spec says design at 390px first, and Impeccable is explicit that a phone screen comped in landscape is a broken frame rather than a neutral default. So the reference is the *desktop* first-viewport contract, and we need a portrait composition for the phone — same world, same six bubbles, re-composed for a tall narrow frame. That is a design decision I would rather make with you looking at it than alone.

---

## WHAT REMAINS BINDING

- Every hard rule in Build Spec §6 (security) and §7 (global agent rules).
- The autonomy protocol loop, and the reversibility gate on every irreversible action.
- Single-user constraint. Never-invent. Agent boundaries. Thread isolation.
- Europe/Lisbon, year-round, including the summer offset.
- The pinned visual world. I do not get to reinterpret it.

---

## HOW TO USE THIS PACKAGE

Read `01` and `02` in full — they are the ones that change what gets built. Skim `03` and `04`, then come back to whichever section you want to edit. Read `05` properly; it contains things that are broken. Answer `06`.

Read `07` — it is the new material. Then answer the three questions in the constraints above and we start Stage 1.
