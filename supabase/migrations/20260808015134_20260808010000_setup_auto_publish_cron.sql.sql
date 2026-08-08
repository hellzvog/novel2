-- Install pg_cron for scheduled jobs (required for auto-publishing scheduled chapters)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule auto_publish_chapters() to run every minute.
-- The cron job runs as the postgres superuser, which can execute the
-- SECURITY DEFINER function without granting EXECUTE to anon/authenticated.
-- This does NOT change any RLS policies or function grants.
SELECT cron.schedule(
  'auto-publish-chapters',
  '* * * * *',
  $$SELECT public.auto_publish_chapters();$$
);
