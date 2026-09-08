# §02 — DESIGN DIRECTION
### Typography, colour, layout, and the 3D plan. How the reference becomes the build.

---

## 1. THE REFERENCE, READ HONESTLY

What your image actually contains, element by element:

| Element | What it is | What it costs to build |
|---|---|---|
| Ground | Vertical-ish gradient, deep blue `#2E5FC4`-ish → violet → magenta, with a cyan lift bottom-left | Trivial. CSS. |
| Brain | Photoreal 3D render, pink/violet subsurface glow, warm rim light on the gyri | A raster asset. Cannot be CSS. |
| Bubbles ×6 | Soap-film spheres — thin-film iridescence, not flat glass. Each has a specular highlight, a caustic bright arc bottom-right, and colour that shifts across the surface | **This is the hard part.** See §5. |
| Bokeh | Small out-of-focus violet spheres scattered behind | Cheap. Part of the background plate. |
| Wordmark | Script capital `N` with a long swash + `IXON` in a geometric sans, all caps, tight | Ship as an asset. See §3. |
| Tagline | `NICOLE'S POLYMATH ASSISTANT`, small caps, wide tracking, flanked by two yellow asterisk glyphs | Live text. |
| Bottom nav | Five flat pastel blocks — teal, periwinkle, dusty rose, sky, coral — dark text | Live UI. |
| Bubble labels | White caps, centred, varying size | **Contrast problem.** See §4. |

**The size variance is the most interesting thing in the image.** HELIX is large, COMPASS is small, FORGE and EMBER are mid. Right now that reads as arbitrary composition. It should not be. See §7.

---

## 2. THE ANTI-GENERIC RULES — IMPECCABLE'S CRAFT FLOOR

This is the actual refusal list from `reference/craft-floor.md`, verbatim in substance. These are the defaults AI reaches for. I am bound by them, and you should hold me to them.

### Page scaffolds — refused
- Same-size cards of icon + heading + text as the page structure. *"Cards are the lazy container; nested cards are always wrong."*
- The hero-metric template: big number, small label, supporting stats, accent.
- **A kicker or eyebrow above a heading. This one is a hard ban, not a default** — *"no brief earns it back."*
- Section numbers (01 / 02 / 03) unless the sequence carries information.
- A modal for a task needing neither interruption nor protected focus.

### Surface habits — refused
- **Gradient text.** Emphasis comes from weight or size.
- **Glass and blur as decoration** rather than as a specific effect. ← *directly relevant to your bubbles; see §5*
- A coloured `border-left` above 1px on cards, list items, callouts, alerts.
- Hard offset shadows (`4px 4px 0`) outside an actually-neobrutalist world.
- Sparklines, progress rings, and soft-shadowed rounded rectangles standing in for content.
- Monospace as a costume for "technical" rather than for code, data, or measurement.
- A system display face as the display voice of an own-world page.
- **Unicode glyphs or emoji standing in for an icon system.** ← *your spec uses 🌅 ⏰ 🌆 🌙 in push titles. Fine in a notification. Not in the UI.*
- Geometric masks standing in for organic contours — a radial-gradient cutout approximating a photographic subject's edge. ← *directly relevant to the brain*
- Light or dark picked by category rather than from the use scene.

### The named font blacklist

From `new-work.md`, these are called out as *"training-data defaults [that] mean you stopped looking"*:

> Fraunces, Playfair Display, Cormorant, Lora, Crimson, Newsreader, Syne, Space Grotesk, Space Mono, IBM Plex, Inter-as-display, DM Sans, DM Serif, Outfit, Plus Jakarta Sans, Instrument Sans.

Using one requires a reason no other face could satisfy — and *"a subject association is never that reason."*

### The calibration warning — read this one twice

> *"AI-generated interfaces cluster around a few looks regardless of subject: warm cream ground, high-contrast serif display, and a terracotta accent; **near-black with one neon accent and glowing edges**; broadsheet-editorial hairlines with tracked mono labels."*

Your reference is adjacent to cluster #2. It is a *pinned brief*, so it is allowed — but the discipline is: reach the specific version in your image (soap-film iridescence, the script `N`, pastel nav), not the generic version (purple gradient, flat glass orbs, neon glow, Space Grotesk). Those are different pictures that photograph the same at thumbnail size.

---

## 3. TYPOGRAPHY

### The wordmark: treat as a brand asset, do not re-cut it

The `Nixon` lockup in your image is a designed piece of art — a script `N` with a swash that underlines `IXON`. Trying to reproduce that with a web font will produce a worse version of something you already have. **Ship it as an optimised SVG.** Record it in `PRODUCT.md` under Brand Commitments so no later pass "improves" it.

If you need it live for any reason, the script `N` is in the Didone-script family (Snell Roundhand / Bickham lineage). Say so and I will source a licensed face.

### The system faces — proposal, open to your veto

Nixon is `Operate` mode. From `typeset.md`: *"Operate and Read surfaces are well served by system stacks and workhorse UI faces."* Expression goes into the material world, not the letterforms — a dashboard you read four times a day should not have opinionated body text.

| Role | Proposal | Why |
|---|---|---|
| **Wordmark** | Your SVG asset | Already designed. Untouchable. |
| **UI / body** | **Geist** or **Public Sans** | Neither is on the blacklist. Both have real numerals, tabular figures, and enough weights. Geist has slightly more character; Public Sans is the safer workhorse. |
| **Data / metrics** | Same family, `font-variant-numeric: tabular-nums` | Times, counts, IC50 values, revenue. Columns must align. |
| **Code / lab values** | **Geist Mono** or **JetBrains Mono** | *Only* for actual code, plate IDs, and measurements. Never as decoration. |

The tagline `NICOLE'S POLYMATH ASSISTANT` is set in wide-tracked small caps in your image. That is fine as a wordmark component. It is **not** a licence to use tracked small caps as section labels elsewhere — that is the eyebrow pattern, which is banned.

### The scale — enumerated, not arbitrary

Impeccable's own system enumerates every step and the detector allows ±0.5px around each. Their note is instructive: the ramp they replaced *"had 86 distinct sizes, including six near-identical steps between 13.7px and 15.4px that no reader could tell apart."*

Proposed ramp at 16px root:

```
 8px  0.5rem    badge counters, superscript markers
10px  0.625rem  micro-labels (use rarely)
12px  0.75rem   metadata, timestamps, thread tags
14px  0.875rem  secondary body, table cells, nav labels
16px  1rem      body floor — never smaller for prose
18px  1.125rem  lead paragraph, ask questions
20px  1.25rem   card titles
24px  1.5rem    screen titles
32px  2rem      section display
48px  3rem      the one number that matters (asks count)
```

**Rules from `typeset.md` and `craft-floor.md` that bind:**
- Body measure 65–75ch. Prose 45–75ch.
- Display max 6rem. Tracking floor -0.04em.
- More space above a heading than below it.
- Light text on dark surfaces needs compensation on all three axes: slightly more line-height, a touch more tracking, one more weight step. **Your entire app is light-on-dark. This is not optional.**
- Repeated roles stay identical across screens and states.

---

## 4. COLOUR — AND THE THREE-WAY CONFLICT YOU NEED TO RESOLVE

### The conflict

Your three documents specify three different palettes:

| Source | Says |
|---|---|
| `CLAUDE_CODE_BUILD_SPEC.md` §5 | *"Palette: gradient purple → blue → black. This is the specified direction — follow it."* with `#0A0612` base, `#7C3AED` violet |
| `CLAUDE_CODE_MASTER_PROMPT_REVISED.md` §9 | Pastel. `#FAFAF9` warm off-white page, white panels, seven agent pastels, dark ink text |
| `README_START_HERE.md` | *"You changed it to pastel at the last minute"* |
| **Your reference image** | **Neither.** A saturated blue→violet→magenta gradient with white text and a pastel *nav bar only* |

The reference image is the most recent artifact and the one you attached to this request, so I am treating it as the intent — but I will not build on that assumption silently. **This is decision #1 in §06.**

### Strategy

From `new-work.md`, colour strategy is picked *before* colours: Restrained, Committed, Full palette, or Drenched. Your reference is **Drenched** — the surface *is* the colour, the gradient owns the whole ground.

The documentation warns that Drenched is permitted on Persuade and Experience surfaces. On `Operate` surfaces — Tasks, Asks, Settings — *"expression may never obscure the task, state, or familiar affordance."* So:

**Proposal: drenched Home, restrained everywhere else.** The gradient world is the identity and it owns Home. Tasks/Asks/Chat/Settings inherit the palette but flip to a near-solid deep ground with the gradient reduced to an edge or a header band. Same world, task-appropriate density. This is how the reference survives contact with an actual working dashboard.

### Tokens — OKLCH, because lightness is predictable

`colorize.md`: *"For a new web palette, prefer OKLCH because lightness and chroma can be adjusted predictably."* Values below are my read of your image; they get measured properly against the comp during the spec phase.

```css
:root {
  /* Ground — the gradient world */
  --ground-deep:    oklch(38% 0.16 265);  /* deep blue, top-left */
  --ground-mid:     oklch(45% 0.19 300);  /* violet, centre */
  --ground-hot:     oklch(58% 0.22 340);  /* magenta, bottom-right */
  --ground-lift:    oklch(70% 0.14 235);  /* cyan lift, bottom-left */

  /* Working surfaces — Operate screens */
  --surface:        oklch(24% 0.06 285);  /* panel on gradient */
  --surface-raised: oklch(30% 0.07 285);
  --surface-sunk:   oklch(19% 0.05 285);

  /* Text — all on dark */
  --text:           oklch(97% 0.01 285);  /* body */
  --text-muted:     oklch(80% 0.03 285);  /* metadata — VERIFY 4.5:1 */
  --text-faint:     oklch(66% 0.03 285);  /* large text only, >=3:1 */

  /* State */
  --urgent:         oklch(70% 0.20 25);   /* the Asks badge */
  --running:        oklch(80% 0.15 195);  /* a job in flight */
  --done:           oklch(78% 0.16 155);
}
```

### Agent identity colours

Your Master Prompt assigns each agent a pastel. Keep the *hues*, restate them for a dark ground — a `violet-100` background with `violet-900` text is a light-mode construction and inverts badly.

| Agent | Hue | Dark-ground treatment |
|---|---|---|
| Nixon | violet | The gradient itself. Nixon is the world, not a chip. |
| Helix | emerald | `oklch(72% 0.14 155)` as rim/label, `oklch(28% 0.06 155)` as fill |
| Ember | orange | `oklch(76% 0.15 55)` / `oklch(30% 0.07 55)` |
| Compass | sky | `oklch(75% 0.13 230)` / `oklch(28% 0.06 230)` |
| Ledger | amber | `oklch(80% 0.14 85)` / `oklch(30% 0.07 85)` |
| Cadence | rose | `oklch(74% 0.15 15)` / `oklch(29% 0.07 15)` |
| Forge | indigo | `oklch(70% 0.14 275)` / `oklch(27% 0.07 275)` |

Your rule *"pastel is always a background, never text on white"* is correct and preserved — inverted for the dark world.

### The contrast problem in your reference — must be solved, not ignored

**White centred labels sitting directly on translucent bubbles over a mid-tone gradient will fail WCAG AA.** The bubble is translucent, so the effective background is whatever the gradient is behind it — which varies across the bubble and changes as it drifts. Your Build Spec §6 makes contrast a hard requirement and says explicitly: *"Do not rely on gradient backgrounds behind body text; place text on a solid panel colour so contrast is deterministic."*

Three ways out. My recommendation is **B**:

- **A — Label below the bubble.** Set the agent name on the solid ground under each sphere. Deterministic. Cleanest. Costs the exact centred look of your reference.
- **B — Opaque core disc.** A small solid-fill disc inside the bubble carrying the label, in that agent's dark-ground fill colour. Preserves the composition, makes contrast fixed, and gives you a place to put the agent's status. **Recommended.**
- **C — Keep it, and constrain the gradient behind the bubbles.** Flatten the ground to a narrow lightness band wherever a bubble can sit, so white is always ≥4.5:1. Preserves the reference exactly but constrains the animation path.

---

## 5. THE 3D — THIS IS THE SECTION YOU ASKED ABOUT MOST

### The honest problem

Your bubbles are **soap-film iridescence**: colour produced by thin-film interference, shifting across the surface, with a specular highlight and a caustic arc. That is a physical optical effect.

The lazy version is `backdrop-filter: blur()` plus a white radial gradient — glassmorphism. `craft-floor.md` refuses it by name: *"Glass and blur as decoration rather than as a specific effect."* It will read as generic AI UI and it will not look like your image. **I will not build it that way**, and if I do, hold up this page.

Four honest routes:

### Route A — Rasters (safest, cheapest)
Generate each bubble and the brain as a high-resolution image asset, keyed to alpha, placed as `<img>`. Impeccable's build has a whole phase for exactly this (`plates`) with a scoring gate against the comp crop.

- **Pros:** photoreal, matches your reference precisely, near-zero runtime cost, works on every device, no fallback needed.
- **Cons:** static. A bubble cannot deform, pop, or react to touch. Six agents × several states = several assets each.
- **Verdict:** this is the baseline. Even if we do B or C, we build A first so there is always something correct on screen.

### Route B — WebGL / Three.js thin-film shader (the real thing)
A genuine fragment shader computing thin-film interference over a sphere, with an environment map and refraction. `overdrive.md` names WebGL explicitly for *"effects CSS can't express."*

- **Pros:** actually iridescent. Reacts to pointer, drifts, deforms, responds to agent state in real time. This is the version that makes someone say "how did you do that."
- **Cons:** roughly 40–60KB gzipped for a minimal WebGL layer (OGL, not full Three.js). Needs a real fallback. Battery cost on mobile. `overdrive.md` requires a proposal round before any code, and requires browser-automation iteration because *"technically ambitious effects almost never work on the first try."*
- **Verdict:** the right answer for the Home hero only. Not for six bubbles on every screen.

### Route C — SVG filter chain (the clever middle)
`feTurbulence` + `feDisplacementMap` + `feSpecularLighting`, CSS-animatable. `overdrive.md` lists it under *"organic distortion effects."*

- **Pros:** no JS library, animatable, genuinely organic rather than a gradient pretending.
- **Cons:** SVG filters are expensive to composite; six animating simultaneously on a mid-range phone will drop frames. Rendering differs subtly across browsers.
- **Verdict:** good for one hero bubble or for hover states. Not for all six at once.

### Route D — CSS only, done properly
Layered `radial-gradient` + `conic-gradient` with `@property`-registered custom properties so the gradient *positions* animate (normally impossible in CSS), plus `mix-blend-mode: screen` for the caustic.

- **Pros:** zero dependencies, cheap, degrades perfectly.
- **Cons:** will not reach photoreal. Reads as "stylised bubble", not "photograph of a bubble".
- **Verdict:** the fallback layer under B or C. Also the correct choice for the small bubbles that appear in Tasks/Asks list rows, where photoreal would be noise.

### My recommendation — the layered plan

```
Home hero        →  Route B (WebGL) with Route A raster as the <noscript>/
                     reduced-motion/low-power fallback
Home bubbles ×6  →  Route A rasters, one per agent per state,
                     with Route D CSS for the drift and the state glow
Other screens    →  Route D only. Small, quiet, cheap.
Brain            →  Route A raster, always. Alpha-keyed, not
                     geometric-masked (craft floor bans the mask shortcut).
prefers-reduced-motion →  everything static, rasters only
```

### The rules that bind whichever route we take

From `overdrive.md`, non-negotiable:
- **Progressive enhancement.** The experience without the effect must still be good.
- Target 60fps. Below 50, simplify.
- Lazy-init WebGL contexts only when near viewport.
- **Pause off-screen rendering. Kill what you can't see.** ← critical; this thing runs all day on her phone
- Test on a real mid-range device, not the dev machine.
- **Never layer multiple competing extraordinary moments.** *"Focus creates impact, excess creates noise."*
- Never use technical ambition to mask weak design fundamentals.

And the two tests I owe you afterwards:
- **The removal test:** take the effect away. Does the experience feel diminished, or does nobody notice?
- **The device test:** run it on her actual phone. Still smooth?

---

## 6. RESOLVING THE HOME-SCREEN CONFLICT

Your reference is an `Experience` composition. Your spec says Home is a command bar plus "what needs me / what's running". Three resolutions:

**Option 1 — Splash/lock screen.** The reference *is* the first thing you see on open, for about 1.5 seconds, or until you tap. Then it resolves into the working Home. Full drama, zero cost to daily use.
*Risk:* an interstitial between her and her work, four times a day. Gets old fast.

**Option 2 — The bubbles ARE the working Home.** The six spheres are the six thread cards your Build Spec §5 already calls for. Bubble size = number of open items. Bubble brightness = activity. A red caustic = an ask waiting. Tap a bubble → that thread. Command bar sits below the brain. The brain is the Nixon status object — it pulses when a job is running.
*This makes the decoration functional*, which is the whole craft-floor principle: *"every visual element must earn its place."* **Recommended.**

**Option 3 — Two modes.** A toggle between "constellation" (the reference) and "list" (dense). More to build, more to maintain, and it defers the decision rather than making it.

**Option 2 also fixes the size-variance problem.** In your image, HELIX is big and COMPASS is small for compositional reasons. In Option 2 that becomes *information*: HELIX is big because the thesis has seven open items today. Tomorrow COMPASS is big because six evaluations are due. The composition breathes with her actual workload. That is the difference between a picture of a dashboard and a dashboard.

---

## 7. MOTION

`animate.md` requires a **motion thesis** before any implementation: one focal moment, plus quiet supporting states. *"A generic fade-and-rise, hover lift, parallax layer, or scroll reveal is not a thesis."*

**Proposed thesis:** *The bubbles drift. The brain breathes. Everything else is instant.*

| Moment | Motion | Duration |
|---|---|---|
| Bubbles at rest | Slow independent drift, ~20s cycles, never synchronised | continuous, pausable |
| Agent starts work | Its bubble brightens and its drift speeds slightly | 300ms in |
| Ask arrives | That bubble's caustic arc turns urgent; badge counts up | 400ms, once |
| Nixon thinking | Brain subsurface glow pulses | 2s cycle, only while a job runs |
| Tap a bubble | It expands into the thread view via View Transitions — shared element, so the bubble *becomes* the panel | 350ms |
| Every button, toggle, field | 100–150ms. Instant. No personality. | — |

Timing table from `animate.md`: 100–150ms feedback, 150–300ms routine state change, 300–500ms layout/overlay, 500–800ms one authored entrance. Exit faster than entrance. Natural deceleration `cubic-bezier(0.16, 1, 0.3, 1)`. No bounce or elastic by reflex.

`prefers-reduced-motion` gets an intentional alternative, not a kill switch: drift stops, state changes still communicate through colour and opacity.

---

## 8. THE BROWSER SURFACES — THE CHEAPEST WIN

From `craft-floor.md`, and the one models skip most reliably:

> *"The parts you did not draw still carry the design. Text selection, the caret, custom scrollbars, focus rings, underline offset, and the numerals in tabular data all ship with browser defaults that belong to no design system. Theme them from the palette. This is the cheapest signal that a page was built rather than assembled."*

So: `::selection` in the magenta. Caret colour set. Scrollbars themed. Focus rings from the palette, visible, never `outline: none`. `text-underline-offset` tuned. `font-variant-numeric: tabular-nums` on every count, time, and currency value.

Ten lines of CSS. It is the single highest ratio of "looks designed" to effort in the entire build.
