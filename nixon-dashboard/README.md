# Nixon Dashboard

A web front-end for the Nixon Telegram agent. It reads and writes the same
Supabase tables the bot already uses, and updates live the moment the bot writes
something.

It invents no backend and stores nothing of its own.

---

## Run it locally

```bash
pnpm install
cp .env.example .env.local     # then fill in the two Supabase values
pnpm dev                       # http://localhost:5173
```

```bash
pnpm build     # typecheck + production build
pnpm preview   # serve the build
```

## Environment variables

| Variable | Where to get it |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `VITE_SUPABASE_ANON_KEY` | same page → **anon public** key (never the service_role key) |
| `VITE_BOT_USERNAME` | your bot's @username, without the @ |

All three are baked in at build time. Change one and you must build again.

If they are missing the app renders a "Not configured" notice rather than a
blank page.

## The SQL you run once

`docs/12_DASHBOARD_RLS.sql` in the repository root. Paste it into Supabase → SQL
Editor → Run.

It switches on row-level security and allows access to any signed-in user, which
is only Nicole, since signups are turned off. This matters: the anon key ships
inside the site and anyone who opens it has that key. The policies are the real
protection, not the login screen.

The Edge Functions use the service_role key and bypass row-level security, so
the Telegram bot is unaffected.

## What is read-only and what is not

| Table | Dashboard |
| --- | --- |
| `tasks` | reads, ticks off, and adds |
| `memory` | reads and edits values |
| `daily_state` | **read only** — the agent owns the day's state machine |
| `learning` | **read only** |
| `messages` | **read only** |
| `settings`, `processed_updates` | no access at all |

A task added here does not create a calendar event. Only Nixon does that, so
tell it in Telegram if the task needs a date.

## The screens

- **Home** — the brain, six agent bubbles with live open-task counts (red when
  something is overdue), today's state in plain English, and the first six open
  tasks with a tick box.
- **Tasks** — everything grouped by agent, filtered by Open, In progress, or
  Done today, plus a form to add one.
- **Asks** — what is waiting on her, derived from the state machine and overdue
  deadlines. No table backs this.
- **Chat** — the Telegram conversation, live.
- **Settings** — memory rows grouped into connected files, standing orders, and
  about me, each editable.
- **Agent detail** at `/agent/helix` and so on, with lessons for Helix and
  Cadence.

## Deploying to Vercel

1. `pnpm dlx vercel` from this folder, and follow the prompts.
2. In the Vercel dashboard open the project → **Settings** → **Environment
   Variables**.
3. Add all three variables from the table above, for **Production**.
4. Redeploy, since variables are read at build time.

`vercel.json` rewrites every path to `index.html`, so refreshing on `/tasks`
works instead of 404ing.

## Known gaps

- **The chat composer is read-only.** Sending from the web would need an Edge
  Function running the agent, and every message costs part of a very small daily
  Gemini allowance. Replies go through Telegram; they appear here instantly.
- **No delete.** Nixon owns removing tasks and memory. Ask it in Telegram.
- **One account.** There is no signup and no password reset in the app. Create
  the user in Supabase → Authentication → Users.
- **The brain is decoration.** If WebGL is unavailable it silently becomes a
  glowing orb.

## Notes for changing the code

- `src/hooks/useLive.ts` subscribes each component to a table and refetches on
  any change. Channel names include a per-instance id, because two components
  watching the same table with the same channel name makes the second
  subscription fail.
- `src/lib/supabase.ts` deliberately does not throw when configuration is
  missing. Vite inlines those variables at build time, so a top-level throw
  becomes unconditional and the bundler deletes the rest of the application —
  a successful build that ships a blank page.
- The state machine is never duplicated here. `src/lib/phase.ts` only translates
  `daily_state.phase` into English.
