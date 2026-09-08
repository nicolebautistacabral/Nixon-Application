# YOUR COMPLETE BUILD PACKAGE — What You Have & How to Use It

Nicole, you now have four documents that together define everything needed to build your Nixon agent application. Here's what each one is, why it matters, and how they fit together.

---

## 📋 THE FOUR DOCUMENTS

### 1. **CLAUDE_CODE_BUILD_SPEC.md**
**What it is:** The technical blueprint — every requirement, database table, API integration, security rule, and agent function.

**What it covers:**
- §0: What you're building (single-user, six agents, Telegram)
- §1: The seven agents (Nixon + six subagents) with their exact functions
- §2: The student evaluation template (input form → three outputs)
- §3: Telegram interface (four daily pulses, bot commands)
- §4: Database schema (tables, relationships)
- §5: Frontend design direction (gradient purple/blue/black — but you're changing to pastel)
- §6: Security checklist (non-negotiable)
- §7: Global agent rules (honesty, safety, privacy, wellbeing, tone)
- §8: Build phases (Phase 1 → 2 → 3 → 4)
- §9: Start here (questions to confirm before coding)

**How to use it:** Reference this constantly while building. Every code decision should trace back to a line in this spec. If something isn't in the spec, you ask before building.

---

### 2. **BUILD_SPEC_ADDENDUM_UX_AND_AUTONOMY.md**
**What it is:** The UX/interaction layer plus the core autonomy protocol that makes your whole system work.

**What it covers:**
- §10: UX/UI specification (pastel palette, screen map, buttons, responsive rules, empty/error states)
- §11: Autonomy protocol (the loop from instruction → report, clarify rules, confirm rules, self-preservation rules, standing instructions)

**Why it matters:** This addendum transforms the dry technical spec into a living system. §11 especially is the heart of your application — it's how you go from "one instruction" to "finished work without re-prompting."

**How to use it:** When building the job-execution layer, live in §11. When building UI, reference §10.

---

### 3. **NixonDashboard.jsx**
**What it is:** A working React prototype you can click through.

**What it shows:**
- Five screens (Home, Tasks, Asks, Chat, Settings)
- The command bar at the top of Home
- How asks (pending decisions) are displayed
- Running jobs list
- Thread cards
- Responsive layout (mobile bottom nav, desktop sidebar)
- Pastel colour palette and component styling

**How to use it:** This is your reference for layout and interaction. You're building the real, connected version of this mockup. The prototype uses mock data and state changes locally; your version will integrate with real agents, a real database, and real Telegram.

---

### 4. **CLAUDE_CODE_MASTER_PROMPT_REVISED.md** ← USE THIS ONE
**What it is:** The system prompt to paste into Claude Code at the start of your build session.

**What it does:**
- Encodes everything from the specs above as binding rules for the AI coding assistant
- **Part 2:** Teaches Claude to understand your intent comprehensively (inferring gaps while respecting your instructions) — the "think like Claude" balance
- **Part 4:** Full push notification setup (native phone alerts, not just Telegram messages)
- Defines what "thorough" means for scientific writing, creative writing, tutoring, etc.
- Specifies the memory protocol (never forget a word of what Nicole instructed)
- Lays out the security checklist as non-negotiable
- Defines responsive, honest communication
- Establishes that specs come before AI judgment

**How to use it:** Paste this entire file as your system prompt in Claude Code before you start any work. It will guide all coding decisions. This is the **revised** version; use this instead of the original.

---

### 5. **PUSH_NOTIFICATION_IMPLEMENTATION.md**
**What it is:** A detailed guide for integrating native push notifications (the alarm-style pop-ups on your phone).

**What it covers:**
- Firebase Cloud Messaging setup (recommended)
- Backend service for sending notifications
- Four daily pulses as push alerts
- Quiet hours enforcement
- Service worker setup
- React hooks for subscribing to notifications
- Testing and production checklist

**Why it matters:** Without this, your daily reminders sit in Telegram chat. With this, they wake up your phone at 08:00, 12:00, 18:00, 22:00 with native notifications, plus your Portuguese lessons, quizzes, and competition deadlines.

**How to use it:** Follow this guide in Phase 1 when setting up Telegram integration. You'll need a Firebase project (free, ~30 min setup).

---

## 🚀 HOW TO START

### Step 1: Confirm the tech stack
Before you write a single line of code, confirm with Claude Code:

```
I'm building Nicole Bautista Cabral's personal agent dashboard (Nixon).
The stack is:
- Backend: Node.js + Express (TypeScript)
- Frontend: React + Vite + Tailwind
- Database: PostgreSQL (via Supabase or self-hosted)
- Scheduler: BullMQ
- Messaging: Telegram Bot API (`telegraf` package)
- Auth: single-user session auth, server-side

The full spec is in CLAUDE_CODE_BUILD_SPEC.md.
The UX/autonomy spec is in BUILD_SPEC_ADDENDUM_UX_AND_AUTONOMY.md.
The UI reference is NixonDashboard.jsx.

Before I start Phase 1, I need to:
1. Confirm this stack is right for the requirements
2. Create the directory structure
3. Set up .env, .gitignore, and gitleaks pre-commit hook
4. Set up the Postgres schema with RLS
5. Implement single-user session auth with argon2id + TOTP
6. Run the §6 security checklist

Which should we start with?
```

### Step 2: Questions you need to answer for Claude Code

Before it starts coding, have these ready:

1. **Hosting:** Local development on your machine, or a small VPS (DigitalOcean ~$5/month) so the app runs 24/7 without your laptop on? (Recommend the VPS for scheduled automations.)
2. **Telegram bot:** Do you have a bot token from @BotFather yet? If not, create one and paste it here.
3. **Postgres:** Will you use Supabase (hosted, easiest) or self-hosted Postgres?
4. **Priority first:** Which integration should we connect first — Google Sheets, Google Docs, Instagram, or something else?

### Step 3: Build in phases

**Phase 1 (Foundation — 2–3 days):**
- Repo, .env, gitleaks
- Postgres schema + RLS policies
- Single-user auth (argon2id + TOTP)
- Helmet + HTTPS + CSP headers
- Rate limiting
- Basic Telegram bot connection (send a test message)
- **Security checklist passes before Phase 2**

**Phase 2 (Agents — 3–4 days):**
- Agent module scaffolding
- Nixon router and scheduler
- Each subagent (Helix → Compass → Cadence → Ledger → Ember → Forge)
- Test each agent in isolation

**Phase 3 (Integrations — 3–4 days):**
- Google Sheets API (priority)
- Google Docs API
- Google Calendar API
- Zoho API (if time)
- Gumroad API
- Base44 API (knowledge tracker)
- (Instagram/TikTok last — they have API approval requirements)

**Phase 4 (Automations + Polish — 2–3 days):**
- Four daily pulses
- Cadence's lesson/quiz/refresher cycle
- Reminder queue (scheduled jobs)
- Spaced-repetition engine
- Dashboard UI (the React prototype connected to real data)
- Settings panel
- Mobile polish
- Lighthouse pass (≥90 Performance, Accessibility, Best Practices)

---

## ✅ BEFORE YOU HAND OFF TO CLAUDE CODE

1. **Read all four documents.** You don't need to memorize them, but you need to know they exist and what they cover.
2. **Make sure the build spec matches your memory.** If you find yourself thinking "wait, I said something different," flag it now before building.
3. **Have your Telegram bot token ready.** (Or create one in 2 minutes via @BotFather.)
4. **Decide on VPS or local.** A $5/month DigitalOcean droplet will run your scheduled automations 24/7; a local machine only while it's on.
5. **Paste the revised master prompt.** When you open Claude Code, paste `CLAUDE_CODE_MASTER_PROMPT_REVISED.md` into the system prompt box before typing anything else. This is the updated version with intelligent inference and push notification guidance.

---

## 📝 NOTES ON THE PASTEL COLOUR PALETTE

The original spec said "gradient purple blue black." You changed it to "pastel" at the last minute. I've defined pastel as:

- Warm off-white page (#FAFAF9)
- White panels (#FFFFFF)
- Seven agent pastels, each paired with a dark ink of the same hue
- Pastel is always a background, never text on white (to keep contrast high)

The palette is in the UX Addendum (§10.1) and baked into the master prompt (§7). When Claude Code builds the frontend, it will use these colours by default. If you want to adjust any of them, tell Claude Code and it will update everywhere.

---

## ⚠️ REMEMBER: THIS IS NOT OPTIONAL

These four documents are your constitution. They are not starting points for negotiation. Every line is something you thought through, and they are binding on the development process. 

If Claude Code suggests a shortcut or a simplification, ask yourself: *"Does the spec allow this?"* If not, push back. If it does, ask Claude Code to show you which section of the spec supports the shortcut before proceeding.

The goal is not to build fast. The goal is to build exactly what you specified, with no shortcuts, no feature creep, and no AI judgment overriding your instructions.

---

## 🎯 YOU'RE READY

You have:
- ✅ A technical specification (Build Spec)
- ✅ A UX specification (Addendum)
- ✅ A working prototype to reference (Dashboard.jsx)
- ✅ A revised system prompt that understands your intent AND remembers everything (Master Prompt Revised)
- ✅ A complete push notification guide (so your phone actually wakes up)

The next step is to open Claude Code, paste the **Revised Master Prompt**, and say:

> I'm ready to build. Here's my stack [confirm], here's my Telegram bot token [paste], here's where I'm hosting [VPS/local], I've read the push notification guide and I'm ready to integrate that, and I'm going Phase 1 first. What do we start with?

That's it. You're ready. 🚀

---

**Your agents are ready to work. Time to build them.**
