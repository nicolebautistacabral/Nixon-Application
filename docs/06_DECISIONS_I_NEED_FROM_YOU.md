# §06 — DECISIONS I NEED FROM YOU
### Answer these and building starts. Everything else I can infer.

Nine questions. Four are blocking; five have a sane default I will take if you say nothing.

---

## BLOCKING — I cannot start without these

### 1. The palette *(conflict B-1)*
Your three documents specify three different things and your reference image is a fourth. Pick one:

- **(a) The reference image.** Saturated blue→violet→magenta gradient world, white text, pastel bottom nav. Drenched on Home, restrained on the working screens (§02 §4). ← *what I assume you mean, since you attached it*
- **(b) Pastel**, per Master Prompt §9 — warm off-white page, white panels, dark ink, seven agent pastels as backgrounds.
- **(c) Gradient purple→blue→black**, per Build Spec §5, `#0A0612` base.
- **(d) Something else** — tell me.

### 2. Hosting and database
- **Hosting:** local machine, or a VPS (~$5/month DigitalOcean)? **Scheduled automations need uptime** — if the laptop is closed at 08:00, no Morning Brief. Recommendation: VPS.
- **Postgres:** Supabase (hosted, easiest, `auth.uid()` RLS works out of the box) or self-hosted (more control, RLS needs the `current_setting` pattern — conflict B-5)?
- **Redis:** yes or no? BullMQ needs it, and it fixes the duplicate-send defect A-7. Recommendation: yes.

### 3. What Home actually is *(conflict B-3)*
Your reference is a hero composition. Your spec says Home opens with the command bar and answers "what needs me / what's running". Pick:

- **(a) The bubbles ARE the working Home.** Six spheres = six threads. Size = open items. Brightness = activity. Urgent caustic = an ask waiting. Command bar under the brain. Tap a bubble → that thread. ← **recommended**, and it is the only option where the decoration earns its place
- **(b) Splash then dashboard.** Reference shows for ~1.5s on open, then resolves into a dense working Home.
- **(c) Two modes**, toggleable.

### 4. Do the four daily pulses override quiet hours? *(conflict B-2)*
As specified, the 22:00 Final Sync fires exactly at the start of quiet hours, so it is queued and silently delivered at 08:00 the next day alongside the Morning Brief. Pick:

- **(a)** All four pulses ignore quiet hours. They are the point of the system. ← simplest, matches the implementation code
- **(b)** Pulses respect quiet hours; move Final Sync to 21:30 so it lands before the window. ← matches Master Prompt §4.3, and is what I would choose
- **(c)** Quiet hours become 23:00–07:00 so all four pulses fit inside the waking window.

---

## DEFAULTS — I will take these unless you say otherwise

### 5. The 3D bubbles — how far?
My recommendation, from §02 §5:
> **Home hero:** real WebGL thin-film shader, with a raster fallback for reduced-motion and low-power. **The six bubbles:** rasters plus CSS drift. **Other screens:** CSS only. **Brain:** always a raster, alpha-keyed.

Say "all rasters" if you want it simpler and cheaper, or "full WebGL everywhere" if you want to spend the performance budget there. Note that `overdrive.md` requires me to put 2–3 concrete directions in front of you before writing any shader code, so you will get another look at this regardless.

### 6. Typography
Proposal: your existing wordmark as an SVG asset, untouched. **Geist** for UI and body. **Geist Mono** for code, plate IDs, and measurements only. Say if you want Public Sans instead, or if you have a licence for something specific.

### 7. What bubble size means *(if you pick 3a)*
Default: **number of open items in that thread.** Alternatives: urgency of the nearest deadline, time since you last touched it, or minutes of work logged this week.

### 8. Overload watch definition *(NX-10)*
Default: three or more deadlines inside 48h, **or** activity logged after 23:00 on three consecutive days, **or** the same task deferred four times. Fires once, names the pattern, does not repeat.

### 9. Which integration first *(Phase 3)*
Default: **Google Sheets.** It carries the logbook, student matrix, competitions, and revenue tracking — four agents at once. Then Docs, then Calendar, then Gumroad, then Base44, then Zoho. Instagram/TikTok last, per your own §1.3 caveat.

---

## THE IMPROVEMENTS FROM §05 — accept or reject

Reply with numbers, or "all", or "design only".

**Design:** C-1 bubble size means something · C-2 opaque core disc for label contrast · C-3 bubble-becomes-panel transition · C-4 quiet mode on working screens · C-5 theme browser surfaces · C-6 empty states early

**Engineering:** C-7 one notification abstraction · C-8 ask state machine · C-9 idempotency keys · C-10 log redaction rules up front · C-11 real dry-run mode · C-12 field encryption in Phase 1 · C-13 test the restore · C-14 rate-limit external APIs · C-15 one Lisbon clock module

The nine defects in §05 Part A are not improvements — they are bugs, and I will fix them as part of the build unless you tell me not to.

---

## WHAT I HAVE ALREADY ASSUMED

So you can correct me:

- Europe/Lisbon for everything.
- Mobile-first at 390px; Nixon is used on a phone far more than on a desktop.
- Comp-first build path, because you have a reference you want matched exactly (§01 §6).
- Your reference image is a **pinned brief** — the world is locked and I do not get to reinterpret it.
- Impeccable's craft floor binds me except where your brief explicitly overrides it (§02 §2).
- Telegram stays as a peer channel permanently, not a temporary fallback — because iOS web push has real constraints (§05 A-9).
- All 23 Impeccable commands are available, but the build actually needs about twelve of them.

---

## TO START

Reply with something like:

> 1(a) · 2: VPS + Supabase + Redis yes · 3(a) · 4(b) · 5 default · 6 default · 7: open items · 8 default · 9 default · improvements: all · [anything I got wrong]

and I will begin with `npx impeccable install` and `/impeccable init`.
