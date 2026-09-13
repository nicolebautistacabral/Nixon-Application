-- Nixon — scheduled pulses (Phase 6)
--
-- DO NOT run this with `supabase db push`. It carries a secret, so paste it
-- into Supabase → SQL Editor by hand, after replacing PUT_YOUR_CRON_SECRET_HERE
-- with the value of NIXON_CRON_SECRET.
--
-- Two jobs only. They fire every hour at :00 and :15; the pulse function reads
-- Lisbon time and decides whether anything is actually due. That way the
-- schedule survives daylight saving with no cron changes, and an extra call
-- costs nothing because the function returns a no-op.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('nixon-pulse-hourly') where exists (
  select 1 from cron.job where jobname = 'nixon-pulse-hourly'
);
select cron.unschedule('nixon-pulse-quarter') where exists (
  select 1 from cron.job where jobname = 'nixon-pulse-quarter'
);

select cron.schedule(
  'nixon-pulse-hourly',
  '0 * * * *',
  $$
  select net.http_post(
    url := 'https://hvbrfflcwqegqnzuyput.supabase.co/functions/v1/pulse',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-nixon-secret', 'PUT_YOUR_CRON_SECRET_HERE'
    ),
    body := '{}'::jsonb
  );
  $$
);

select cron.schedule(
  'nixon-pulse-quarter',
  '15 * * * *',
  $$
  select net.http_post(
    url := 'https://hvbrfflcwqegqnzuyput.supabase.co/functions/v1/pulse',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-nixon-secret', 'PUT_YOUR_CRON_SECRET_HERE'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Check both jobs exist:
--   select jobid, jobname, schedule, active from cron.job;
-- See the last few runs:
--   select jobid, status, return_message, start_time
--     from cron.job_run_details order by start_time desc limit 10;
