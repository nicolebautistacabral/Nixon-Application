-- Nixon — Telegram update de-duplication (Phase 7)
--
-- Telegram re-delivers an update when it does not get a prompt 200, and the
-- agent's work now runs in the background after the 200 is sent. Without this
-- table a retry would re-run the same message: a second calendar event, a
-- second lesson, and a second bite out of a 20-request daily model budget.

create table processed_updates (
  update_id bigint primary key,
  seen_at timestamptz not null default now()
);

create index on processed_updates (seen_at);

alter table processed_updates enable row level security;
