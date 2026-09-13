-- Nixon dashboard — row-level security
--
-- Paste this whole file into Supabase → SQL Editor → Run, once.
--
-- The dashboard ships with the anon key, which is public by design: anyone who
-- opens the site has it. These policies are therefore the only thing protecting
-- the data. They allow access to a signed-in user, and Nicole's is the only
-- account that exists.
--
-- The Edge Functions use the service_role key and bypass RLS entirely, so the
-- Telegram bot keeps working untouched.

alter table tasks              enable row level security;
alter table memory             enable row level security;
alter table daily_state        enable row level security;
alter table learning           enable row level security;
alter table messages           enable row level security;
alter table settings           enable row level security;
alter table processed_updates  enable row level security;

do $$
declare t text;
begin
  foreach t in array array['tasks','memory','daily_state','learning','messages'] loop
    execute format('drop policy if exists %I_auth_all on %I', t, t);
    execute format(
      'create policy %I_auth_all on %I for all to authenticated using (true) with check (true)', t, t);
  end loop;
end $$;

-- `settings` holds the owner chat id and pulse bookkeeping. The dashboard has no
-- reason to touch it, and `processed_updates` is pure plumbing, so neither gets a
-- policy: RLS with no policy denies the anon and authenticated keys outright.

-- Realtime: the dashboard listens for the agent's writes.
alter publication supabase_realtime add table tasks;
alter publication supabase_realtime add table daily_state;
alter publication supabase_realtime add table learning;
alter publication supabase_realtime add table messages;
alter publication supabase_realtime add table memory;

-- Check what you ended up with:
--   select tablename, policyname, roles from pg_policies where schemaname = 'public';
