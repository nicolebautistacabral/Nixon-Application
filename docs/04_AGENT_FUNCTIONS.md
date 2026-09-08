# §04 — AGENT FUNCTIONS
### Function by function. Input → processing → expected output → automation trigger.

This is the spec restated as buildable units. Every row is one function with one testable output. When you want to change how something works, point at the function ID.

**Read the legend once:**
- **Trigger** — what starts it: `manual` (you ask), `cron` (scheduled), `event` (something happened), `chain` (another function finished)
- **Reversible?** — if `no`, the autonomy protocol requires a confirmation before executing
- **Output** — what actually lands, and where

---

## NIXON — THE COORDINATOR

Nixon owns routing, the schedule, and the Telegram/push bridge. **Every subagent's outbound message goes through Nixon.** No subagent messages you directly. This is what makes batching and quiet hours possible at all.

| ID | Function | Trigger | Input | Output | Reversible |
|---|---|---|---|---|---|
| NX-1 | Route instruction to agent | event | Your raw text | Job created on the right agent, with the inference stated back to you | yes |
| NX-2 | Morning Brief | cron 08:00 | Open tasks, deadlines, all six threads | Push + Telegram: priorities today | yes |
| NX-3 | Mid-Day Pivot | cron 12:00 | Completed since 08:00, what shifted | Push + Telegram | yes |
| NX-4 | Evening Wind-down | cron 18:00 | Today's log, what to pause | Push + Telegram | yes |
| NX-5 | Final Sync | cron 22:00 | Board state, tomorrow's plan | Push + Telegram | yes |
| NX-6 | Batch subagent updates | continuous | All non-urgent subagent output | Held, folded into the next pulse | yes |
| NX-7 | Urgency gate | event | A subagent wants to interrupt | Sends only if: deadline <24h, failed automation, or confirmation needed | yes |
| NX-8 | Quiet-hours enforcement | continuous | Outbound message + your settings | Sent, or queued to `quiet_hours_end` | yes |
| NX-9 | Status Check master list | manual `/status` | All six thread states | One scannable summary | yes |
| NX-10 | Overload watch | cron daily | Stacked deadlines, late-night activity, repeated emergencies | **Names the pattern once.** No lecture, no repeat. | yes |
| NX-11 | `/pause` / `/resume` | manual | Command | Holds or restarts all non-urgent messages | yes |

**NX-10 needs a definition from you.** "Overload pattern" is currently undefined. Proposal: three or more deadlines inside 48h, OR activity logged after 23:00 on three consecutive days, OR the same task deferred four times. Say if that is wrong.

---

## HELIX — THE SCIENTIST

Context Helix must hold at all times: MSc Biomedicine, ICVS Universidade do Minho. 384-well phenotypic screen, ~10,000 ChemBridge DIVERSet compounds, *P. falciparum* 3D7 (CQ-sensitive) and Dd2 (CQ-resistant). SYBR Green I read-out. **Core hypothesis: compounds killing both strains equally are resistance-independent hits — the goal.** 3D7-only killers are logged but deprioritised. Supervisors: Maria Isabel Veiga, Joana Pereira-Sousa.

### Category 1 — Malaria Experiment Logbook

| ID | Function | Trigger | Input | Output | Reversible |
|---|---|---|---|---|---|
| HX-1 | Log a lab step | manual, `/log`, or voice | Your dictated action | Row in Google Sheet: `Date \| WP \| Step \| What I Did \| Why It Matters \| Mechanism \| Risk if Missed \| Flag Status` | yes |
| HX-2 | Generate reasoning columns | chain from HX-1 | The raw action you supplied | Helix writes Reasoning, Mechanism, and Risk. **You supply the action; Helix supplies the science.** | yes |
| HX-3 | Never-invent guard | chain from HX-1 | Any unstated value | Cell reads `not recorded`. **Never a plausible guess.** | — |
| HX-4 | Deviation tracker | chain from HX-1 | Anything departing from SOP | Logged and linked to possible downstream effects | yes |
| HX-5 | Carry-forward reminder | cron, next session | Previous flags | *"Last session you flagged well A1 for edge-effect — recheck today"* | yes |
| HX-6 | Attention engine | chain from HX-1 | The day's rows | Surfaces missed controls, DMSO drift, skipped reference reads | yes |
| HX-7 | WP-aware flags | chain from HX-1 | Current work package | WP1/2 → CVs, hematocrit, edge effects. WP3 → **Z′ ≥ 0.5 before WP4.** WP4–6 → hit rates, IC50 shifts. Always → pin-tool fixed volume, autofluorescence (*"did we run the compound-only reference read?"*), DMSO ≤0.5% | yes |
| HX-8 | Weekly rollup | cron Sunday | Week's rows | Short "state of the experiment" summary | yes |

### Category 2 — Thesis Document
| ID | Function | Trigger | Input | Output | Reversible |
|---|---|---|---|---|---|
| HX-9 | Draft a section | manual | Section name + logbook data | Google Docs draft **from real recorded data only** | yes |
| HX-10 | Citation flagging | chain | Draft text | Inline `[cite: needed]` + running "sources to gather" list | yes |
| HX-11 | Outline tracker | continuous | Doc state | What is drafted / pending / blocked on lab data | yes |
| HX-12 | Literature search | manual | Query | PubMed/PMC → Web of Science, Scopus → ScienceDirect → IEEE Xplore, **in that order** | yes |
| HX-13 | Anti-fabrication gate | continuous | Every claim | Cited, marked as your own data, or flagged `unverified — check before citing`. **No invented citations or values, ever.** | — |

### Category 3 — Presentation
| ID | Function | Trigger | Input | Output | Reversible |
|---|---|---|---|---|---|
| HX-14 | Slide planner | manual | Version (proposal / mid / final) | Slide-by-slide following your arc: *a killer is still winning → our best weapon is failing → nobody small enough is fixing it → I will build the tool and find the next weapon* | yes |
| HX-15 | Speaker script + timing | chain | Slide plan | Script with timings; **flags sections running long against the 11–12 min target** | yes |
| HX-16 | Q&A prep | chain | Script + thesis | Anticipated questions with draft answers | yes |

### Category 4 — Daily Neuroscience & Genetics
| ID | Function | Trigger | Input | Output | Reversible |
|---|---|---|---|---|---|
| HX-17 | Daily concept | cron | Curriculum + Base44 tracker | One concept, precise terminology, plain language, ending with a one-line "talk-ready" version | yes |
| HX-18 | Spaced repetition | cron | Delivery history | Refreshers at 1 day, 3 days, 1 week, 1 month | yes |
| HX-19 | Recall quiz | cron | Recent concepts | Telegram inline buttons, low stakes | yes |
| HX-20 | **Health-advice boundary** | continuous | Every lesson topic | Explains **general** science only. No personalised dietary, medical, or health advice. No interpretation of personal health data. Drifts toward personal recommendation → reframe to general mechanism or pick another topic. | — |

---

## EMBER — THE CREATIVE

**The defining constraint: Nicole writes. Ember does not.**

| ID | Function | Trigger | Input | Output | Reversible |
|---|---|---|---|---|---|
| EM-1 | Manuscript review | manual | Read access to your Google Docs | Reviewer / proofreader / structural feedback. **Explicitly forbidden: ghostwriting, drafting prose in your voice, rewriting your sentences.** Points out a problem and explains it; you make every change. | yes |
| EM-2 | Manuscript progress | cron | Doc state | Word count, pages, sections done vs planned, days since last edit | yes |
| EM-3 | @chantpaint calendar | manual | Your content | **EN and TL tracks kept separate** — separate calendars, separate analytics | yes |
| EM-4 | Video packaging | manual | Your raw content | CapCut / OpusClip prep | yes |
| EM-5 | Post preparation | manual/cron | Scheduled item | **Post + caption + asset ready to paste, delivered to Telegram.** Not auto-posted. See note below. | yes |
| EM-6 | Competition search | manual/cron | Genre + window | Google Sheet rows: `Competition \| Country \| Genre \| Prize \| Deadline \| Entry Fee (must be 0) \| Link \| Submission Status \| Draft Location` | yes |
| EM-7 | Competition filter | chain | Search results | **Cash prize, zero entry fee.** Small and obscure included — fame is not a criterion. Priority genres: poetry, spoken word, short fiction, essay. | yes |
| EM-8 | Deadline reminders | cron | Competition sheet | Push + Telegram at 7 days, 3 days, 1 day | yes |
| EM-9 | @neurogenicole | manual | Science content | Canva/Higgsfield design, caption, hashtag research, engagement analytics | yes |
| EM-10 | Unified Ember tracker | continuous | All of the above | One Google Sheet, four tabs: manuscript / @chantpaint (EN + TL columns) / @neurogenicole / competitions | yes |
| EM-11 | Auto-post | manual | Approved post | **Only if API access is actually granted.** | **no** |

**The integration reality, per your own spec §1.3:** Instagram's Content Publishing API needs a Business/Creator account plus app review; TikTok's Content Posting API needs approved developer access. Auto-posting may not be approvable for a personal account. **Build EM-5 (prepare-and-hand-over) first. Do not show auto-posting in the UI until it actually works.**

---

## COMPASS — THE PROFESSIONAL

| ID | Function | Trigger | Input | Output | Reversible |
|---|---|---|---|---|---|
| CP-1 | Team SOPs | manual | Process description | SOP + onboarding doc | yes |
| CP-2 | Automation mapping | manual | Manual workflow | Zoho Flow or n8n design | yes |
| CP-3 | Content calendar sync | cron | Campaign plan | Synced to **both** Zoho Calendar and Google Calendar | yes |
| CP-4 | Campaign planning | manual | Campaign brief | Dedicated Google Sheet | yes |
| CP-5 | Student matrix | continuous | Lesson outcomes | Google Sheet: `Student \| Level (A1–C2) \| Progress \| Key Struggles \| Evaluation History \| Next Step` | yes |
| CP-6 | Lesson planning | manual | Student + topic | Google Doc | yes |
| CP-7 | **Evaluation generator** | manual | The §2 input form | Three outputs at once — see below | yes |
| CP-8 | Send evaluation | manual | Generated evaluation | Qarint + Teams + Telegram | **no** |
| CP-9 | Daily tutoring admin | cron | Schedule | Reminders, materials prep | yes |

### CP-7 in detail — this is your highest-frequency function

**Input:** Student, Date, Class type (Booked / Trial + duration), Level, Status, Topic, Activities, Learned words, Needs to learn, Speaking 1–5, Listening 1–5, Grammar 1–5, Notes.

**Processing:** one evaluation covering seven dimensions **in natural prose with no visible headers** — Lesson Content, Participation, Understanding & Application, Communication & Behavior, Strengths (specific, not generic), Areas for Improvement (constructive, never harsh), General Evaluation & Suggestions.

**Tone:** professional, warm, encouraging, specific to that lesson. **Sentence structure varies between students so evaluations never read as templated.**

**Output — all three generated together:**
- **Qarint review box** — single paragraph, no line breaks, 4–6 sentences
- **Teams** — `Teacher / Student / Date / Class / Level / Status / Evaluation:` + 5–8 sentences
- **Telegram** — same fields, 5–8 sentences

**Special cases:** no-show → brief status note, still all three formats. Technical issue → acknowledge without blaming the student. Trial class → one extra sentence on potential, encouraging regular booking (trial evaluations are partly recruitment).

**Note:** star ratings and word lists are entered by you directly in Qarint's UI. Compass weaves the words into the prose rather than listing them.

**Privacy rule, absolute:** a student's name or details never appear in any output outside their own evaluation thread, and never cross into another thread's work.

---

## LEDGER — THE HUSTLER

| ID | Function | Trigger | Input | Output | Reversible |
|---|---|---|---|---|---|
| LG-1 | Product mapping | manual | Idea or expertise area | What to build, demand, market comparison | yes |
| LG-2 | Product files | continuous | Product work | Dedicated Google Drive folder | yes |
| LG-3 | Gumroad copy | manual | Product | Landing page copy | yes |
| LG-4 | Product descriptions + email sequences | manual | Product | Draft copy | yes |
| LG-5 | Launch checklist | chain | Product | Per-product checklist | yes |
| LG-6 | TikTok launch videos | manual | Product | Video plan. **Handle stays configurable — TBD.** | yes |
| LG-7 | Gumroad stats | cron | Gumroad API | **Honest** reading: what converts, what does not | yes |
| LG-8 | Pricing research | manual | Product | Grounded in real comparable-product data, not guesswork | yes |
| LG-9 | Revenue tracking | cron | Sales data | Google Sheets | yes |
| LG-10 | Sales ping | event | New sale / milestone | Push notification | yes |
| LG-11 | Publish to Gumroad | manual | Approved product | Live listing | **no** |

**Hard rule, encoded in the agent prompt:** no fake urgency, no fake scarcity, no fabricated testimonials, no claims a product does not deliver. Organic-first distribution — you are time-constrained.

---

## CADENCE — THE LINGUIST

European Portuguese is the priority. Korean, Spanish, Mandarin, Indonesian, Arabic, Italian follow later — **build so a second language can be added without restructuring** (language is a column, not a fork).

| ID | Function | Trigger | Input | Output | Reversible |
|---|---|---|---|---|---|
| CD-1 | Morning lesson | cron 07:00 | Curriculum position | Words, phrases, full sentences, cultural note. Push: *"Today's lesson: [topic]"* | yes |
| CD-2 | Curriculum sequencing | continuous | Lessons 1…N-1 | **Chronological and cumulative.** Lesson N builds on everything before it, so progress is traceable in order. | yes |
| CD-3 | Evening quiz | cron ~20:00 | Today's material | Telegram inline buttons. Push: *"Quiz ready"* | yes |
| CD-4 | Morning refresher | cron, before CD-1 | Yesterday's material | **Must be cleared before new content arrives.** | yes |
| CD-5 | Spiral review | cron | Older material | Spaced schedule cycling back | yes |
| CD-6 | Slang and idiom | chain | Lesson content | Everyday expressions from early on — goal is native-sounding, not textbook | yes |
| CD-7 | **European not Brazilian** | continuous | Every output | **Flags the difference explicitly whenever it matters.** | — |
| CD-8 | Never-invent-slang guard | continuous | Any slang | Only real, current, regionally-attributed usage | — |

**CD-4 is a sequencing dependency, not a preference.** The refresher gates the lesson. If it is not cleared, CD-1 holds. That needs to be built as an actual state machine, not a hope.

---

## FORGE — THE BUILDER

| ID | Function | Trigger | Input | Output | Reversible |
|---|---|---|---|---|---|
| FG-1 | IC50 calculator | manual | Dose-response data | Curve fit + IC50 | yes |
| FG-2 | 384-well heatmap | manual | Plate data | Visualiser. **Convention: teal = sensitive (3D7), red = resistant (Dd2).** | yes |
| FG-3 | Resistance-index calculator | manual | 3D7 + Dd2 IC50s | Index — this is what identifies your resistance-independent hits | yes |
| FG-4 | Dilution helper | manual | Stock + target | Dilution scheme | yes |
| FG-5 | Base44 knowledge tracker | event | **Anything you report learning, from any thread** | Tracker updated. Backbone of HX-18. | yes |
| FG-6 | Portfolio site | manual | Content | Neuroscience/genetics animated portfolio | yes |
| FG-7 | "The Manuscript" theme | manual | Design | WordPress theme | yes |
| FG-8 | Google API syncs | continuous | Sheets, Docs, Drive, Calendar | Bidirectional sync | yes |
| FG-9 | n8n / Zoho Flow | manual | Flow design | Deployed flow supporting Compass | yes |
| FG-10 | Local AI stack | manual | — | Ollama, OpenCode, Cursor maintenance | yes |
| FG-11 | **Telegram + push bridge** | continuous | All agent output | Delivery to your phone | yes |
| FG-12 | Deploy | manual | Merged code | Live | **no** |

**Hard rules:** reversible-first — branch → PR → review → merge, **never direct to `main`**. Never run a destructive command (`rm -rf`, `DROP TABLE`, force-push) without explicit confirmation naming the specific target. No secrets in code, ever — if one is found in the repo, tell you to rotate it immediately. If a build or test fails, say exactly which one and why. No covering, no silent failures.

FG-1 through FG-4 feed Helix Categories 1 and 2 directly.

---

## THE AUTONOMY PROTOCOL — HOW EVERY FUNCTION ABOVE ACTUALLY RUNS

```
INSTRUCTION → PARSE → PLAN → CLARIFY? → EXECUTE → CONFIRM? → REPORT
                                 ↑                     ↑
                          only if genuinely      only if
                             ambiguous          irreversible
```

**The `Reversible` column above is what drives the CONFIRM gate.** Every `no` row pauses and confirms, naming the specific target. Every `yes` row proceeds and logs.

**Infer, do not ask, when:** context makes intent obvious; your past instructions cover the gap; the action is reversible; a standing rule applies.

**Ask — once, bundled — when:** two past instructions conflict with the current one; scope is genuinely unbounded; an irreversible action has an unclear target; you lack the context to infer.

**Default to inference.** Death by a thousand clarifications is the failure mode your Master Prompt Part 2 was written to prevent.

**Always state what was inferred:**
> *"I'm interpreting 'log that' as: WP2 plate, hematocrit 2%, edge-effect flag on A1. If I got it wrong, I can re-log."*

---

## AUTOMATION SCHEDULE — EVERYTHING ON A CLOCK, IN ONE PLACE

All times Europe/Lisbon.

| Time | Function | Agent | Wakes your phone? |
|---|---|---|---|
| 07:00 | Portuguese morning lesson | Cadence CD-1 | yes |
| 07:00 | Yesterday's refresher (gates the lesson) | Cadence CD-4 | with CD-1 |
| 08:00 | Morning Brief | Nixon NX-2 | yes |
| 12:00 | Mid-Day Pivot | Nixon NX-3 | yes |
| 18:00 | Evening Wind-down | Nixon NX-4 | yes |
| ~20:00 | Portuguese quiz | Cadence CD-3 | yes |
| 22:00 | Final Sync | Nixon NX-5 | **see §06 decision #4** |
| 22:00–08:00 | Quiet hours | Nixon NX-8 | queued, not sent |
| Daily | Neuroscience concept + spaced refreshers | Helix HX-17/18 | yes |
| Daily | Overload watch | Nixon NX-10 | only if it fires |
| Weekly (Sun) | Experiment rollup | Helix HX-8 | no — folds into a pulse |
| Event | Competition deadline 7/3/1 days | Ember EM-8 | yes |
| Event | Sale / revenue milestone | Ledger LG-10 | yes |
| Event | Ask waiting on you | Nixon NX-7 | yes — ignores quiet hours |
| Event | Job failed | Nixon NX-7 | yes — ignores quiet hours |
| Event | Job completed, took >5 min | Nixon | yes |
