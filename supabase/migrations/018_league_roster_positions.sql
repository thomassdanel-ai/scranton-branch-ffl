-- =============================================================================
-- 018_league_roster_positions.sql
-- Cache Sleeper league roster slot positions on the `leagues` row.
--
-- Background:
--   The public /leagues/[id]/matchups page used to call Sleeper's getLeague
--   endpoint at request time to obtain `roster_positions` (the ordered list
--   of starter slot labels — QB, RB, WR, FLEX, …). Removing the runtime
--   Sleeper dependency cost us those slot labels on the lineup expand.
--
--   Persisting the array on the leagues row keeps it queryable from the
--   public render path. The cron sync rewrites it on each cycle, and the
--   admin "link Sleeper" setup step seeds it on initial link.
--
-- Shape: JSONB array of strings, e.g. ["QB","RB","RB","WR","WR","TE","FLEX",
-- "K","DEF","BN","BN","BN","BN","BN","BN"]. Bench/IR slots are filtered out
-- on read. Nullable so older rows (pre-cron-refresh) gracefully fall back.
-- =============================================================================

ALTER TABLE leagues
  ADD COLUMN IF NOT EXISTS roster_positions JSONB;
