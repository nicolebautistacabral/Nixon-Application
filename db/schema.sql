-- Nixon — workflow system schema
-- Postgres. Six tables. Applied to the `nixon` database.
--
-- Design notes:
--   * `messages` is append-only. Never UPDATE, never DELETE. If classification
--     is wrong later, the original sentence is still here to rebuild from.
--   * `tasks` is written only by the svc.board workflow. Nothing else writes it.
--   * user_id is carried on every table even though there is one user, so a
--     dashboard can be added later without a migration.

BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------- users

CREATE TABLE users (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email              TEXT NOT NULL UNIQUE,
  telegram_chat_id   TEXT UNIQUE,
  timezone           TEXT NOT NULL DEFAULT 'Europe/Lisbon',
  calendar_id        TEXT,               -- the dedicated "Nixon" sub-calendar
  quiet_hours_start  TIME NOT NULL DEFAULT '22:00',
  quiet_hours_end    TIME NOT NULL DEFAULT '08:00',
  paused             BOOLEAN NOT NULL DEFAULT false,   -- /pause and /resume
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------- agents

CREATE TABLE agents (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  thread      TEXT NOT NULL,
  calendar_color_id TEXT,     -- Google Calendar colorId, 1-11
  enabled     BOOLEAN NOT NULL DEFAULT true,
  last_run_at TIMESTAMPTZ
);

INSERT INTO agents (slug, name, thread, calendar_color_id) VALUES
  ('nixon',   'Nixon',   'coordination', '3'),
  ('helix',   'Helix',   'science',      '10'),
  ('ember',   'Ember',   'creative',     '6'),
  ('compass', 'Compass', 'professional', '9'),
  ('ledger',  'Ledger',  'business',     '5'),
  ('cadence', 'Cadence', 'language',     '4'),
  ('forge',   'Forge',   'technical',    '1');

-- ---------------------------------------------------------------- messages
-- Verbatim capture. APPEND ONLY.

CREATE TABLE messages (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id),
  agent_id     UUID REFERENCES agents(id),
  thread       TEXT,
  role         TEXT NOT NULL CHECK (role IN ('user','agent','system')),
  body         TEXT NOT NULL,
  source       TEXT NOT NULL DEFAULT 'telegram',
  attachments  JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX messages_user_created_idx ON messages (user_id, created_at DESC);

-- Enforce append-only at the database, not by discipline.
CREATE OR REPLACE FUNCTION messages_are_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'messages is append-only: % is not permitted', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER messages_no_update BEFORE UPDATE OR DELETE ON messages
  FOR EACH ROW EXECUTE FUNCTION messages_are_immutable();

-- ---------------------------------------------------------------- memory
-- What the system concluded from what she said. Visible and revocable.

CREATE TABLE memory_items (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES users(id),
  kind               TEXT NOT NULL CHECK (kind IN
                       ('identity','profile','project','standing_instruction','preference')),
  scope              TEXT NOT NULL DEFAULT 'global',
  agent_id           UUID REFERENCES agents(id),     -- NULL = applies to all
  content            TEXT NOT NULL,
  source_message_id  UUID REFERENCES messages(id),
  status             TEXT NOT NULL DEFAULT 'active' CHECK (status IN
                       ('active','superseded','revoked')),
  supersedes_id      UUID REFERENCES memory_items(id),
  is_sensitive       BOOLEAN NOT NULL DEFAULT false,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed_at       TIMESTAMPTZ,
  last_applied_at    TIMESTAMPTZ,
  revoked_at         TIMESTAMPTZ
);

-- svc.memory reads through this index on every agent run.
CREATE INDEX memory_active_idx ON memory_items (user_id, kind, agent_id)
  WHERE status = 'active';

-- ---------------------------------------------------------------- tasks
-- The board. Written ONLY by svc.board.

CREATE TABLE tasks (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES users(id),
  agent_id           UUID NOT NULL REFERENCES agents(id),
  thread             TEXT,
  title              TEXT NOT NULL,
  detail             TEXT,
  state              TEXT NOT NULL DEFAULT 'todo' CHECK (state IN
                       ('todo','in_progress','blocked','done','cancelled')),
  origin             TEXT NOT NULL DEFAULT 'user' CHECK (origin IN
                       ('user','agent','schedule')),
  priority           INT NOT NULL DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
  source_message_id  UUID REFERENCES messages(id),
  parent_id          UUID REFERENCES tasks(id),
  calendar_event_id  TEXT,             -- event on the Nixon sub-calendar
  resume_url         TEXT,             -- n8n Wait node resume URL while blocked
  blocked_reason     TEXT,
  blocked_until      TIMESTAMPTZ,      -- the 48h approval timeout
  due_at             TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at         TIMESTAMPTZ,
  completed_at       TIMESTAMPTZ,
  cancelled_at       TIMESTAMPTZ,
  last_nudged_at     TIMESTAMPTZ       -- cron.stale, so it does not nag daily
);

CREATE INDEX tasks_open_idx ON tasks (user_id, agent_id, state)
  WHERE state IN ('todo','in_progress','blocked');
CREATE INDEX tasks_done_idx ON tasks (user_id, completed_at DESC)
  WHERE state = 'done';
CREATE INDEX tasks_due_idx ON tasks (user_id, due_at)
  WHERE state IN ('todo','in_progress','blocked');

-- ---------------------------------------------------------------- outputs
-- What a completed task actually produced. Makes the done list a record of
-- work rather than a list of ticks.

CREATE TABLE task_outputs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id),
  task_id     UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL,   -- sheet_row | doc | message_sent | file | note
  label       TEXT NOT NULL,   -- "6 rows added to Logbook Sheet"
  url         TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX task_outputs_task_idx ON task_outputs (task_id);

-- ---------------------------------------------------------------- notifications

CREATE TABLE notification_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id),
  scope         TEXT,            -- morning | midday | evening | final | event | ad_hoc
  title         TEXT,
  body          TEXT,
  channel       TEXT NOT NULL DEFAULT 'telegram',
  idempotency_key TEXT,          -- (scope, date) so a restart cannot double-send
  sent_at       TIMESTAMPTZ,
  queued_until  TIMESTAMPTZ,     -- set when held by quiet hours
  error         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX notification_idem_idx
  ON notification_log (user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

COMMIT;
