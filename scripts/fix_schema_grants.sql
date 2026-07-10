-- ─────────────────────────────────────────────────────────────────────────────
-- Restore Supabase's default privileges on schema public.
--
-- Symptom this fixes:
--   Client queries fail with  { code: "42501", message: "permission denied for
--   schema public" }  for the `authenticated` (and/or `anon`) role. Every query
--   returns empty / errors, so the app shows no orgs, no students, permanent
--   loading — even though the rows exist and RLS policies are correct.
--
-- Cause:
--   Rolling the database back (e.g. DROP SCHEMA public CASCADE; CREATE SCHEMA
--   public;) removes the GRANTs that Supabase normally gives to the anon /
--   authenticated / service_role roles. Error 42501 is thrown BEFORE RLS is
--   evaluated, so no policy can help until these grants are restored.
--
-- Safety:
--   These are the same broad grants Supabase ships with by default. Row-level
--   security still governs which ROWS each role can see — table privileges only
--   grant the ABILITY to query. All tenant tables have RLS enabled (see the
--   multi_tenant migration), so this does not expose tenant data.
--
-- Run the whole file in the Supabase SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. The critical one: let the roles USE the schema at all (fixes 42501).
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- 2. Privileges on everything that already exists in public.
GRANT ALL ON ALL TABLES    IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES  IN SCHEMA public TO anon, authenticated, service_role;

-- 3. Privileges on everything created in public FROM NOW ON (so future
--    migrations / tables don't hit the same wall). These match Supabase's
--    default ALTER DEFAULT PRIVILEGES setup, owned by the postgres role.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT ALL ON TABLES    TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT ALL ON ROUTINES  TO anon, authenticated, service_role;

-- 4. (Optional but recommended) same for the supabase_auth_admin default,
--    which owns objects created by the auth system if any live in public.
-- ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public
--   GRANT ALL ON TABLES TO anon, authenticated, service_role;

-- 5. VERIFY — should list usage/select privileges for authenticated.
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name = 'organization_members'
  AND grantee IN ('anon', 'authenticated')
ORDER BY grantee, privilege_type;
