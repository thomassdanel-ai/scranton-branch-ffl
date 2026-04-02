-- ============================================================
-- Migration 011: Identity Bridge (Phase 4)
-- Adds member_season_id to weekly_results and player_weekly_scores
-- so every team result traces back to a permanent member UUID.
-- ============================================================

ALTER TABLE weekly_results
  ADD COLUMN member_season_id UUID REFERENCES member_seasons(id);

CREATE INDEX idx_weekly_results_member_season ON weekly_results(member_season_id);

ALTER TABLE player_weekly_scores
  ADD COLUMN member_season_id UUID REFERENCES member_seasons(id);

CREATE INDEX idx_pws_member_season ON player_weekly_scores(member_season_id);
