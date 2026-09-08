# §05 — IMPROVEMENTS AND CORRECTIONS
### Defects in the current specs, spec conflicts, and improvements worth making

Part A is things that are **broken** — code as written that will not run, or will run wrongly.
Part B is **spec conflicts** — places your documents contradict each other.
Part C is **improvements** — things that would make it better, which you can accept or reject.

---

# PART A — DEFECTS IN `PUSH_NOTIFICATION_IMPLEMENTATION.md`

Nine of these. Several are fatal. I found them by reading the code, not by assuming.

### A-1 — Invalid JavaScript syntax *(fatal — will not parse)*
`usePushNotification.js` line 494:
```javascript
if ('serviceWorkerContainer' not in navigator) {
```
`not in` is Python. JavaScript has no such operator. The file will throw a `SyntaxError` at build time.

**Fix:** `if (!('serviceWorker' in navigator)) {`

### A-2 — `navigator.serviceWorkerContainer` does not exist *(fatal)*
Used in three places across both documents. The correct property is `navigator.serviceWorker`. `ServiceWorkerContainer` is the *interface name*; the property is `serviceWorker`.

**Fix:** replace every `navigator.serviceWorkerContainer` with `navigator.serviceWorker`.

### A-3 — FCM token / Web Push subscription mismatch *(fatal — notifications will never send)*
This is the important one. The frontend does:
```javascript
registration.pushManager.subscribe({...}).then((sub) => {
  fetch('/api/push-subscribe', { body: JSON.stringify({ fcmToken: JSON.stringify(sub) }) });
});
```
It sends a **raw Web Push subscription object** (endpoint + p256dh + auth keys) and labels it `fcmToken`.

The backend then does:
```javascript
await this.messaging.send({ token: userSettings.fcm_token, ...message });
```
`admin.messaging().send({token})` expects an **FCM registration token** — an opaque Google-issued string. It will reject a serialised PushSubscription. Every send fails, and every send silently falls through to the Telegram fallback. You would conclude push "doesn't work on your phone" when in fact it was never being attempted correctly.

**Fix:** use the Firebase SDK's own token method on the client:
```javascript
import { getMessaging, getToken } from 'firebase/messaging';
const token = await getToken(getMessaging(), {
  vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
  serviceWorkerRegistration: registration,
});
// POST that token
```
Do not hand-roll `pushManager.subscribe` if you are sending through Firebase. Pick one path.

### A-4 — Quiet hours computed in server local time, not Europe/Lisbon *(fatal to correctness)*
```javascript
const now = new Date();
quietStart.setHours(parseInt(startHour), ...);
```
`new Date()` and `setHours` both use the **server's** timezone. On a DigitalOcean droplet that is UTC. Lisbon is UTC+0 in winter but **UTC+1 in summer** — so from late March to late October every quiet-hours boundary is off by an hour. Your 22:00 Final Sync fires at 21:00 local, and the 08:00 unqueue happens at 07:00.

Your Master Prompt's own sample code has the same bug in a different form — it builds a *string* with `toLocaleString('en-US', {timeZone:...})` and then passes that string to a comparison function that expects a Date.

**Fix:** do all scheduling in a timezone-aware library (`luxon` or `date-fns-tz`), store `quiet_hours_*` as local wall-clock times, and compare in the zone:
```javascript
import { DateTime } from 'luxon';
const now = DateTime.now().setZone('Europe/Lisbon');
```
Also set `TZ=Europe/Lisbon` on the server as a second line of defence — but do not rely on it alone.

### A-5 — Infinite re-queue loop *(will spam, then fail)*
`processQueuedNotifications` calls `sendNotification` for each due row. But `sendNotification` re-checks quiet hours and, if still inside, calls `queueNotification` again — creating a *new* row. Meanwhile the original row is marked sent. If the clock or timezone is off by even a minute (see A-4), a notification can queue → fire → re-queue → fire, indefinitely, growing the table.

**Fix:** add a `bypassQuietHours` flag on the queued-send path so a dequeued notification never re-queues. Add a `retry_count` column with a hard ceiling of 3, then dead-letter.

### A-6 — `scheduledFor` can be computed in the past *(immediate re-fire)*
```javascript
const scheduledFor = new Date();
scheduledFor.setHours(parseInt(endHour), parseInt(endMin), 0);
```
At 23:00, with `quiet_hours_end = '08:00'`, this produces **08:00 today** — fifteen hours in the past. The queue processor picks it up on its very next run, one minute later, defeating quiet hours entirely.

**Fix:** if the computed time is not in the future, add one day.

### A-7 — No locking on the queue processor *(duplicate sends)*
The cron runs every minute. If a send takes longer than 60 seconds — entirely possible with a Telegram fallback and a DB write — the next tick starts while the first is still running and picks up the same rows. You get duplicate notifications.

**Fix:** `SELECT ... FOR UPDATE SKIP LOCKED` when claiming rows, or mark rows `processing` before sending. Since your Build Spec already prefers **BullMQ** for retry/backoff, use it here — it handles this natively. **Note: BullMQ requires Redis, which is not currently listed in your stack.**

### A-8 — FCM `data` payload values must be strings
```javascript
data: { deepLink, badge }
```
FCM requires all `data` values to be strings. If `badge` is ever a number, the send is rejected. Your Master Prompt version correctly does `badge.toString()`; the implementation guide does not.

**Fix:** `data: { deepLink: String(deepLink), badge: String(badge) }`

### A-9 — iOS web push has two undocumented hard requirements
The guide says "works on Android, iOS, web, all at once." For **web** push on iOS that is only true if:
1. iOS **16.4 or later**, and
2. the app has been **added to the Home Screen** as a PWA — Safari does not deliver web push to a normal browser tab.

Additionally, `Notification.requestPermission()` must be called from inside a **user gesture** (a tap). The guide calls it inside a `useEffect` on mount, which iOS will reject silently.

**Fix:** a real "Enable notifications" button in Settings, plus a first-run prompt in `onboard`. And you need a `manifest.json` with icons, plus an install prompt. **This is why Telegram remains the fallback and not a nice-to-have.**

### Also worth fixing
- `urlBase64ToUint8Array` uses `[...rawData].map(c => c.charCodeAt(0))` — works, but the conventional `new Uint8Array(rawData.length)` loop is clearer and avoids a spread over a long binary string.
- The service worker hardcodes Firebase config. It cannot read `.env` at runtime — it must be templated at build time or fetched from an endpoint.
- `notification_log` has `opened_at` and `dismissed_at` columns but nothing ever writes them. The `notificationclick` handler should POST back.

---

# PART B — SPEC CONFLICTS

### B-1 — The palette, three ways *(needs your decision)*
| Document | Says |
|---|---|
| Build Spec §5 | "gradient purple → blue → black. **This is the specified direction — follow it.**" |
| Master Prompt §9 | Pastel: `#FAFAF9` page, white panels, dark ink |
| README | "you changed it to pastel at the last minute" |
| Your reference image | Saturated blue→violet→magenta, white text, pastel **nav only** |

These are mutually exclusive. **Decision #1 in §06.**

### B-2 — Do the daily pulses override quiet hours? *(needs your decision)*
Master Prompt §4.3 says pulses **respect** quiet hours and lists "routine updates (pulses, lesson delivery)" explicitly under respect.

The implementation then sends the 08:00 Morning Brief with `priority: 'high'` and the comment `// Override quiet hours`.

The 22:00 Final Sync is sent `priority: 'normal'` — meaning **it will always be queued and never delivered at 22:00**, because 22:00 is the start of quiet hours. Your Final Sync would silently arrive at 08:00 the next morning, on top of the Morning Brief.

**Decision #4 in §06.**

### B-3 — Home screen: `Experience` or `Operate`?
Covered in §01 §5 and §02 §6. Your reference is a hero composition; your spec is a command bar plus status. **Decision #3 in §06.**

### B-4 — Schema does not match its own rule
Build Spec §4 states: *"All tables carry `user_id` and are protected by row-level security."* But the schema listing shows `lab_entries`, `lessons`, `competitions`, `products`, `students`, and `evaluations` **without** a `user_id` column.

**Fix:** add `user_id` to every table. Not a decision — the spec already requires it.

### B-5 — RLS syntax is Supabase-specific
§6.4 says scope rows to `auth.uid()`. That function only exists in Supabase. On self-hosted Postgres you need:
```sql
CREATE POLICY user_isolation ON tasks
  USING (user_id = current_setting('app.user_id')::uuid);
```
with the app setting `app.user_id` per connection. **This depends on decision #2 (Supabase vs self-hosted).**

### B-6 — BullMQ needs Redis, which is not in the stack
Build Spec §0 names BullMQ as preferred. BullMQ requires Redis. Redis appears nowhere in the stack list or the hosting discussion. Either add it (recommended — it also solves A-7) or fall back to `node-cron` plus a database-backed lock.

### B-7 — Emoji in notification titles vs the icon ban
Your pulses use 🌅 ⏰ 🌆 🌙. Impeccable's craft floor bans *"Unicode glyphs or emoji standing in for an icon system."*

**These do not conflict**, and I want to be clear about it: the ban is about **UI**. In a phone notification, emoji are a legitimate glanceability device and the OS renders them natively. Keep them in notifications. Do not carry them into the app's interface — the app gets a drawn icon set.

---

# PART C — IMPROVEMENTS

Accept or reject each one. None are required.

## Design

### C-1 — Make bubble size mean something *(strongly recommended)*
Covered in §02 §6. In your reference, size variance is compositional. Bind it to open-item count and the decoration becomes an information display. This is the single highest-value design change available and it costs nothing extra to build.

### C-2 — Solve the label contrast with an opaque core disc
§02 §4. Preserves your composition, makes contrast deterministic, and gives each bubble a place to carry status.

### C-3 — The bubble becomes the panel
Use the View Transitions API so tapping a bubble morphs it into the thread detail view — the shared element persists. This is `overdrive.md`'s named example. It makes navigation feel physical and it is roughly twenty lines of CSS plus a `startViewTransition` call.

### C-4 — A "quiet mode" for the working screens
Tasks, Asks, and Settings get a dramatically reduced version of the world. Same palette, near-solid ground. Your reference stays the identity; the work stays readable. `/impeccable quieter` exists for exactly this.

### C-5 — Theme the browser surfaces
§02 §8. Ten lines of CSS, highest effort-to-polish ratio in the build.

### C-6 — Design the empty states before the full ones
All six threads start empty. If empty states are an afterthought, day one of using the app looks broken. `/impeccable onboard` handles this properly. **Do this during Stage 3, not Stage 9.**

## Engineering

### C-7 — One notification abstraction, three transports *(strongly recommended)*
Right now push and Telegram are separate code paths with an ad-hoc fallback. Instead:

```
notify(userId, {title, body, deepLink, priority, channels})
        │
        ├─ push (FCM)      ─┐
        ├─ telegram        ─┼─→ whichever are enabled, with per-channel
        └─ in-app (SSE)    ─┘   success/failure logged independently
```

Benefits: one quiet-hours check instead of three, one log table, one place to change tone, and the in-app channel means the dashboard updates live without polling. Telegram stops being a "fallback" and becomes a peer transport.

### C-8 — Make the ask queue a real state machine
Asks are the core of the autonomy protocol, and right now they are implicit. Give them explicit states: `pending → answered → applied`, or `pending → expired`. With a timeout policy and an audit trail of what you decided and when. Without this, a job blocked on an ask just sits invisibly.

### C-9 — Idempotency keys on every scheduled job
A cron that fires twice — because of a restart, a deploy, a clock adjustment — must not send two Morning Briefs. Key each job on `(job_type, date, user_id)` with a unique constraint. Cheap insurance.

### C-10 — Structured agent logs from day one
`agent_logs` exists in your schema with `payload_redacted`. Define the redaction rules **now**, before any agent writes to it — student names, revenue figures, and unpublished thesis data must never land in a log. Retrofitting redaction after logs exist means you have already leaked into your own database.

### C-11 — A dry-run mode for every automation
Your Build Spec §7 already says *"dry-run every automation before running it live."* Make that a real flag, not a discipline: `--dry-run` renders exactly what would be sent, writes nothing, and sends nothing. Especially important for CP-8 (evaluations to three channels) and EM-11 (posting).

### C-12 — Field-level encryption before the first real record
§6.5 requires AES-256-GCM on student names, notes, OAuth tokens, and revenue. **Build this in Phase 1**, not Phase 3. Encrypting a populated table means a migration, a re-key, and a window where plaintext exists in a backup.

### C-13 — Test the restore, not the backup
§6.12 says "automated backups enabled and a restore actually tested once." I want to call this out because it is the one item people tick without doing. A backup you have never restored is a hypothesis.

### C-14 — Rate-limit the agents, not just the routes
Your security checklist rate-limits HTTP endpoints. But an agent in a retry loop can hammer the Google Sheets API into a quota ban, which would take out Helix's logbook, Compass's student matrix, Ember's competition sheet, and Ledger's revenue tracking simultaneously. Put a token bucket in front of each external API, shared across agents.

### C-15 — A single `Europe/Lisbon` clock module
Given A-4, do not let any file call `new Date()` for scheduling. One module exports `now()`, `today()`, and `atLocalTime(hh, mm)`, all zone-aware. Then lint for direct `new Date()` in the scheduling directory.
