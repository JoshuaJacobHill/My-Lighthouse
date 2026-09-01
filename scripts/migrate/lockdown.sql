-- Shut the PostgREST API off.
--
-- Supabase exposes every table over a REST API to the `anon` and
-- `authenticated` roles, and the anon key is publishable by design. This app
-- does not use that API at all: it talks to Postgres directly as `postgres`
-- via Prisma. So the whole surface can simply be closed.
--
-- Two independent measures, either of which would do on its own:
--   1. Revoke the grants, so those roles have no privileges to exercise.
--   2. Enable row level security with no policies, which denies by default.
-- The `postgres` role owns every table and owners bypass RLS, so the app is
-- unaffected.

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON SCHEMA public FROM anon, authenticated;

-- And for anything created later, so a future migration cannot reopen it.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;

DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND NOT rowsecurity
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;
