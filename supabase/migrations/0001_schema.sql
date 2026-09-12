-- Nixon — core schema (Phase 1)

create extension if not exists pg_cron;
create extension if not exists pg_net;

create table tasks (
  task_id text primary key,            -- slug e.g. helix-wp2-report
  agent text not null check (agent in ('nixon','helix','cadence','compass','ember','ledger','forge')),
  task text not null,
  deadline timestamptz,
  status text not null default 'open' check (status in ('open','in_progress','done')),
  priority text default 'medium',
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table memory (
  key text primary key,                -- e.g. helix.lab_logbook_sheet_id, rule.confirm_before_send
  value text not null,
  kind text not null check (kind in ('instruction','id','preference','fact')),
  updated_at timestamptz default now()
);

create table daily_state (
  date date primary key,               -- Lisbon date
  phase text not null default 'cadence_lesson'
    check (phase in ('cadence_lesson','cadence_done','helix_lesson','helix_quiz','open','closed')),
  cadence_day int not null default 1,
  cadence_theme text,
  helix_topic text,
  quiz_round int default 0,
  quiz_scores int[] default '{}',
  notes text,
  updated_at timestamptz default now()
);

create table learning (
  id bigserial primary key,
  date date not null,
  agent text not null,
  topic text,
  content text,
  created_at timestamptz default now()
);

create table messages (                -- conversation memory for the model
  id bigserial primary key,
  chat_id text not null,
  role text not null check (role in ('user','model')),
  content text not null,
  created_at timestamptz default now()
);
create index on messages (chat_id, created_at desc);

create table settings (
  key text primary key, value text not null
);
insert into settings (key,value) values ('owner_chat_id','');   -- filled on first /start

-- Only the service-role key (used by the edge functions) may touch these tables.
-- RLS with no policies blocks the anon/authenticated keys entirely.
alter table tasks enable row level security;
alter table memory enable row level security;
alter table daily_state enable row level security;
alter table learning enable row level security;
alter table messages enable row level security;
alter table settings enable row level security;
