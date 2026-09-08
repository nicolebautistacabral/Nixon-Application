# §01 — THE IMPECCABLE WORKFLOW
### Every skill to employ, in order, and how `DESIGN.md` actually works

I cloned and read `https://github.com/pbakaus/impeccable.git`. Everything below is from the actual repository, not from memory. Version in the repo: **4.2.2**, Apache 2.0.

---

## 1. WHAT IMPECCABLE IS

It is **one skill** with **23 sub-commands**, plus a deterministic detector (a compiled binary — no LLM, no API key) that mechanically catches design anti-patterns in your HTML/CSS as they are written.

Its own product document states its purpose plainly: to stop AI from producing *"looks like an AI made it"* output. That is precisely your ask. It works by three mechanisms:

1. **A shared vocabulary.** Instead of "make it look nicer", you type `/impeccable typeset` or `/impeccable bolder` and get a specific, documented discipline.
2. **A refusal list.** A hard-coded set of the defaults AI reaches for. Impeccable calls it the *craft floor*. Reproduced in §02 of this package.
3. **A forced divergence step.** On any new visual world it runs a dice roll (`concept-seed`) that deals directions from a catalog, specifically so the build does not converge on the category default. This is the single most important part and it is not skippable.

---

## 2. INSTALLATION — DO THIS FIRST

From the project root (`/home/user/Nixon-Application`):

```bash
npx impeccable install
```

It auto-detects Claude Code and writes `.claude/skills/impeccable/`. It also offers to install the **design detector hook** — **say yes.** That hook runs the detector automatically after every UI file edit and surfaces findings back into my flow. It is the difference between me catching my own slop and you catching it.

Alternative if you prefer the plugin route:
```bash
/plugin marketplace add pbakaus/impeccable
# then open /plugin and install Impeccable from the list
```

The skill needs no runtime of its own. It ships a small launcher that downloads a self-contained binary once into `~/.impeccable/bin/`. No Node required for the skill itself.

Verify with:
```bash
/impeccable doctor
```

---

## 3. THE TWO FILES: `PRODUCT.md` AND `DESIGN.md`

This is the part you asked about directly — *"how do I employ the design.md"*. The answer is different from what you expect, and it matters.

### `PRODUCT.md` — product truth. Written FIRST. By `/impeccable init`.

Contains: who uses it, what it does, what must never be fabricated, platform, stack, brand commitments, accessibility requirements, product principles.

Contains **nothing visual**. Init is explicitly forbidden from asking about colour, typography, or aesthetic direction. From `reference/init.md`:

> *"Do not ask for an aesthetic direction, emotional feel, visual references, colors, typography, or style during init."*

For Nixon, `PRODUCT.md` will hold: single-user, Nicole, Europe/Lisbon, six threads plus a coordinator, the never-invent rule, the Category-4 health-advice boundary, the student-data privacy rule, the Instagram/TikTok API reality, WCAG AA.

### `DESIGN.md` — the visual system. Written LAST. From the built interface.

From `reference/new-work.md`:

> *"On a new or replacement world, DESIGN.md is written at finish, from the built world, by the shipped documenter; a rulebook written before the build gets defended against reality instead of describing it, and hands the design-system detector an unstable target."*

So you do **not** hand me a `DESIGN.md` and ask me to implement it. The sequence is:

```
  PRODUCT.md  →  direction round  →  surface brief  →  BUILD  →  DESIGN.md
   (truth)        (you lock one)     (the contract)              (the record)
```

The file that governs the build is not `DESIGN.md`. It is the **surface brief's Direction Contract** — six blocks, 150 words maximum, written before code:

| Block | What it holds |
|---|---|
| **THESIS** | The one idea this surface owns, and the category-default arrangement it refuses |
| **OWN-WORLD** | Palette and component language, specific enough to recognise with all content removed |
| **STORY** | What you understand, believe, and do |
| **FIRST VIEWPORT** | Exact composition — what is where, at what scale, where the primary action sits |
| **FORM** | The chosen direction, its rank, and the seed key |
| **FINISH** | The exit condition. Verbatim boilerplate. Unreviewed and undocumented is unfinished. |

Impeccable's own `DESIGN.md` (29KB, in their repo) shows you the end state: a YAML frontmatter of every token in OKLCH, then sections for Overview, The Kit, Colors, Typography, Elevation and Material, Components, Do and Do Not. That is what yours becomes — *after* Phase 4.

**One exception:** if you want the visual system recorded before Phase 4 is done, `/impeccable document` reads the existing code and writes `DESIGN.md` from it. Useful checkpoint after the Home screen ships.

---

## 4. THE COMMANDS, GROUPED BY WHEN YOU USE THEM

All 23, from the skill's own command table. I have marked the ones your build actually needs and when.

### Build — establishing what exists

| Command | Use it | When in your build |
|---|---|---|
| `init` | Capture product truth in `PRODUCT.md` | **Day 1, before anything** |
| `shape [feature]` | Plan UX/UI *before* writing code | Before each new screen |
| `document` | Generate `DESIGN.md` from existing code | End of Phase 4 (and as a checkpoint after Home) |
| `extract [target]` | Pull reusable tokens/components into the design system | After 3+ screens exist and repetition appears |
| `craft` | Deprecated alias. Ignore it. | Never |

### Evaluate — finding what is wrong

| Command | Use it | When |
|---|---|---|
| `critique [target]` | UX design review with heuristic scoring | After each screen is built |
| `audit [target]` | Technical: accessibility, performance, responsive | Before each phase gate |

`critique` writes a scored snapshot. `polish` later reads that snapshot as its backlog. They are designed to chain.

### Refine — improving what exists

| Command | Use it | When |
|---|---|---|
| `polish [target]` | Final quality pass before shipping | End of every screen |
| `bolder [target]` | Amplify safe or bland designs | If the first build comes out timid |
| `quieter [target]` | Tone down aggressive designs | **Likely needed** — your reference is high-energy; the Tasks and Asks screens must not be |
| `distill [target]` | Strip to essence | If a screen accumulates clutter |
| `harden [target]` | Errors, i18n, edge cases, production-ready | **Phase 4, mandatory** |
| `onboard [target]` | First-run flows, empty states | **Needed** — six threads all start empty |

### Enhance — adding what is missing

| Command | Use it | When |
|---|---|---|
| `typeset [target]` | Typography hierarchy and fonts | After Home structure exists |
| `colorize [target]` | Strategic colour | Only if the world comes out too grey |
| `layout [target]` | Spacing, rhythm, hierarchy | Continuous |
| `animate [target]` | Purposeful motion | Phase 4 |
| `delight [target]` | Personality, memorable touches | Phase 4, sparingly |
| `overdrive [target]` | Push past conventional limits | **This is the 3D one.** See §02. |

### Fix — repairing specifics

| Command | Use it | When |
|---|---|---|
| `clarify [target]` | UX copy, labels, error messages | Phase 4 |
| `adapt [target]` | Different devices and screen sizes | Phase 4 — you are mobile-first at 390px |
| `optimize [target]` | Diagnose and fix UI performance | After the 3D work lands |
| `live` | Pick elements in a running browser, generate alternatives | Any time the dev server is up |

### Utility

- `/impeccable` alone — context-aware menu; it reads the project state and recommends the two or three highest-value next commands. It never auto-runs.
- `/impeccable doctor` — reports drift between your Impeccable artifacts and the current version.
- `/impeccable hooks on|off|status` — manages the detector hook.
- `/impeccable pin <command>` — creates a standalone `/<command>` shortcut, so `/polish` works directly.

---

## 5. THE FOUR MODES — AND THE CONFLICT IN YOUR SPEC

Impeccable classifies every *surface* (not every product) into one of four modes. This determines how much expression is allowed.

| Mode | Visitor's success | Design rule |
|---|---|---|
| **Persuade** | They decide and act | Design *is* the product. Earn attention. |
| **Operate** | They complete a task | Scanability and consistency **outrank expression**. Brand lives in precise details. |
| **Read** | They understand something | Structure for comprehension first. |
| **Experience** | They are inside the work | The artifact leads; the interface recedes. |

**Nixon's five screens are all `Operate`.** Home, Tasks, Asks, Chat, Settings — you are completing tasks, not being persuaded.

**And here is the conflict.** Your reference image is an `Experience` composition: a 3D brain hero, floating iridescent bubbles, the wordmark as art. Your Build Spec says the opposite — Home opens with the command bar as hero, and it answers two questions: *what needs me* and *what's running*.

Both are legitimate. They are not the same screen. **This is decision #3 in §06.** The three ways to resolve it are laid out in §02 §6.

---

## 6. THE DIRECTION ROUND — AND HOW YOUR REFERENCE IMAGE BINDS

You asked: *"how my reference becomes exactly how it should look like."*

Here is the exact mechanism, from `reference/new-work.md`.

### The default behaviour (without your image)

For a new visual world, Impeccable runs:

```bash
.claude/skills/impeccable/scripts/impeccable concept-seed --scope direction --mode operate
```

It deals directions from a catalog by dice roll, plus challengers. I fuse each challenger, judge them on two axes (audience identification, product clarity), then present one committed direction with alternates on a served decision page in your browser. You lock one. The roll exists so runs do not converge on the category default.

### With your image — the brief wins, always

From `SKILL.md`, first rule under *How to design*:

> **"The brief wins.** Honor pinned aesthetics, eras, materials, fonts, and palettes even when they conflict with a saturated-pattern warning. Redirecting a clear brief toward your taste is failure."

And from `new-work.md`:

> *"a user- or brief-pinned direction beats the roll, always."*

So your image is not a mood board I get to reinterpret. Pinned as a brief, it is binding. What I still owe you is honest: there is one caveat, stated in the same document —

> *"A brief-pinned world pins the world, not its softest rendition."*

Meaning: the iridescent-bubble-and-3D-brain world is locked. What is *not* locked is landing on the most obvious, most generic rendition of that world — which, for "purple-blue gradient + glass orbs + glowing brain", is exactly the AI-tool-marketing look Impeccable's own product document names as the thing to avoid. Your image has real specificity (the script `N`, the soap-film iridescence rather than flat glass, the pastel bottom nav). The build has to reach *that*, not the generic version of it.

### To make the image bind, hand it over explicitly

When we start the direction round, say:

> "Pinned brief: the attached reference. This world is locked — 3D iridescent bubbles as the agent objects, dimensional brain as the centre, the Nixon script-plus-caps wordmark, deep blue-to-magenta gradient ground. Do not re-derive the world. Derive the composition, the states, and the system."

That takes the world off the table and puts the roll to work on what is genuinely open: how a bubble looks when its agent is *working* versus *blocked*, how six of them arrange on a 390px phone, what happens when there are eleven asks instead of three.

### Comp-first vs code-first

Init asks this once and records it in `.impeccable/config.json`:

- **comp-first** — an image is generated first and becomes a measured spatial contract. The build is then gated against it region by region, with numeric readings (cap heights, box positions, colour sampling) at 72% fidelity minimum. Bolder composition. Slower. More rebuild rounds.
- **code-first** — build directly; ambition lives in the written contract and is audited at the finish.

**For you: comp-first.** You have a reference image you want matched exactly. Comp-first is the only path with a measurement gate; code-first would have me eyeballing it, and the documentation is blunt that models systematically believe their recreation succeeded when it did not.

One honest caveat from the same reference: comp-first *"is a frontier-tier job"* and stalls smaller models at the hero gate. It should be fine here, but expect several fix rounds at the hero — that is the process working, not failing.

---

## 7. THE FINISH SEQUENCE — WHY YOU GET AN HONEST VERDICT

Every screen ends the same way, and this is why the output will not be self-congratulatory slop:

1. **Batched inspection.** Desktop and mobile captured together, at most two rounds. No open-ended self-QA.
2. **Detector pass.** `impeccable detect --json` on the changed files. Mechanical, deterministic.
3. **A fresh reviewer.** A separate agent is spawned with *no access to my conversation history* — deliberately, so it does not inherit my framing or my optimism. It gets the screenshots, the direction contract, the comp, and the diff reports.
4. **A verdict in one of four words:** `ship`, `fix`, `rebuild`, or `recapture`. I act on the word. I do not get to soften it.
5. **The documenter.** A second fresh agent writes `DESIGN.md` from what was actually built.

The rule I am held to on reporting: a verdict pass scores the listed fixes and nothing else. *"The reviewer scored all three fixes resolved"* is a claim I can make. *"No material issues remain"* is not.

---

## 8. YOUR COMMAND CHEAT SHEET

Pin these after install so they are one word each:

```bash
/impeccable pin critique
/impeccable pin polish
/impeccable pin audit
/impeccable pin adapt
```

Then, day to day:

| You want to say | You type |
|---|---|
| "What should I do next?" | `/impeccable` |
| "This screen feels wrong, tell me why" | `/critique home` |
| "Is this accessible and fast?" | `/audit` |
| "Make it ready to ship" | `/polish` |
| "This is too safe" | `/bolder` |
| "This is too much" | `/quieter` |
| "Fix the type" | `/impeccable typeset` |
| "Fix the phone layout" | `/adapt` |
| "Make the bubbles real" | `/impeccable overdrive` |
| "Let me tweak it live in the browser" | `/impeccable live` |
| "Empty states are bad" | `/impeccable onboard` |
| "Production-ready it" | `/impeccable harden` |
