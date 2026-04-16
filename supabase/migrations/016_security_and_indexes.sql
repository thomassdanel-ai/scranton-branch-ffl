-- =============================================================================
-- 016_security_and_indexes.sql
-- Security hardening + performance indexes.
--
-- Motivation:
--   * First-time-setup TOCTOU (SECURITY_REVIEW #2): make the setup claim atomic
--     via a nullable timestamp on organizations.
--   * Missing composite indexes (PROJECT_REVIEW tech #5): queries already in
--     production are scanning these tables. Add the indexes we actually hit.
-- =============================================================================

-- ----- 1. First-time admin setup claim -------------------------------------
-- The /api/admin/auth PUT endpoint creates the initial super_admin. Previously
-- it checked `count(*) == 0` then inserted non-atomically, so two simultaneous
-- PUTs could both pass the check and both insert. Solution: a single atomic
-- UPDATE that only succeeds for the first caller.
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS setup_claimed_at TIMESTAMPTZ;

-- Backfill: if a super_admin already exists, mark the claim as taken so
-- the PUT endpoint short-circuits even on fresh deploys from existing DBs.
UPDATE organizations o
   SET setup_claimed_at = NOW()
  WHERE setup_claimed_at IS NULL
    AND EXISTS (
      SELECT 1 FROM admin_users a
       WHERE a.org_id = o.id AND a.role = 'super_admin'
    );


-- ----- 2. Performance indexes ---------------------------------------------
CREATE INDEX IF NOT EXISTS idx_weekly_results_season_week
  ON weekly_results(season_id, week);

CREATE INDEX IF NOT EXISTS idx_weekly_results_member_season
  ON weekly_results(member_season_id)
  WHERE member_season_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_member_seasons_league_season
  ON member_seasons(league_id, season_id);

CREATE INDEX IF NOT EXISTS idx_member_seasons_sleeper_roster
  ON member_seasons(sleeper_roster_id)
  WHERE sleeper_roster_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_leagues_sleeper
  ON leagues(sleeper_league_id)
  WHERE sleeper_league_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_league_snapshots_season_week
  ON league_snapshots(season_id, week);

CREATE INDEX IF NOT EXISTS idx_transactions_cache_season_week
  ON transactions_cache(season_id, week);

CREATE INDEX IF NOT EXISTS idx_player_weekly_scores_season_week
  ON player_weekly_scores(season_id, week);

CREATE INDEX IF NOT EXISTS idx_draft_picks_board
  ON draft_picks(draft_board_id);

CREATE INDEX IF NOT EXISTS idx_power_rankings_season_week
  ON power_rankings(season_id, week);


-- ----- 3. Drop the deprecated players_cache table --------------------------
-- Replaced by players_normalized (per-row, indexable, cheaper to query).
-- Safe to drop: no code still references it (verified via grep).
DROP TABLE IF EXISTS players_cache CASCADE;
