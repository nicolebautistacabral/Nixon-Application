# NIXON — UPDATED BUILD PACKAGE
### Read this first. It replaces `README_START_HERE.md` as the index.

**Status:** Planning complete. No application code written yet. Nothing is committed to the app itself.
**Branch:** `claude/impeccable-design-system-je3mcw`
**Date:** 2026-09-08

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
| `06_DECISIONS_I_NEED_FROM_YOU.md` | The short list. Answer these and building starts. |

---

## THE ORDER OF OPERATIONS (high level)

```
  YOU ANSWER §06
        │
        ▼
  Install Impeccable          →  one command, five minutes
        │
        ▼
  /impeccable init            →  writes PRODUCT.md (product truth, no visuals)
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

## WHAT IS BINDING AND WHAT IS OPEN

**Binding — I will not change these without you saying so:**
- Every hard rule in `CLAUDE_CODE_BUILD_SPEC.md` §6 (security) and §7 (global agent rules).
- The autonomy protocol loop.
- Single-user constraint.
- "Never invent" — no fabricated citations, IC50 values, slang, or market data.
- Agent boundaries and the six threads.
- Europe/Lisbon as the system timezone.

**Open — waiting on your answer in §06:**
- The palette (your three documents specify three different things).
- Hosting target.
- How far the 3D goes, and where.
- Whether the four daily pulses override quiet hours.

---

## HOW TO USE THIS PACKAGE

Read `01` and `02` in full — they are the ones that change what gets built. Skim `03` and `04`, then come back to whichever section you want to edit. Read `05` properly; it contains things that are broken. Answer `06`.

Then say: **"Answers below. Start with §01, install and init."** and we go.
