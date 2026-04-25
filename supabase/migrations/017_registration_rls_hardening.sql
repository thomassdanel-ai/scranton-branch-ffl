-- =============================================================================
-- 017_registration_rls_hardening.sql
-- Drop the broad anon INSERT policy on season_registrations.
--
-- Background:
--   Migration 010 created `CREATE POLICY "anon_register" ... TO anon WITH CHECK
--   (true)` so anonymous browser clients could self-register via Supabase JS.
--   The current registration flow at POST /api/register/[token] runs entirely
--   server-side and uses the service-role client (which bypasses RLS), so the
--   policy is unused. Leaving it in place lets a leaked anon key insert
--   arbitrary rows (or junk waitlist entries) into season_registrations
--   directly, bypassing rate limits, capacity checks, member upsert, and the
--   invite token validation that the server route enforces.
--
--   Drop the policy. RLS stays enabled, so anon access falls back to deny.
--   The service-role server route is unaffected.
-- =============================================================================

DROP POLICY IF EXISTS "anon_register" ON season_registrations;
