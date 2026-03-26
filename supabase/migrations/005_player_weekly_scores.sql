-- Player-level weekly scores (starters + bench)
-- Enables recap callouts like "X dropped 35 on your bench"
CREATE TABLE IF NOT EXISTS player_weekly_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID REFERENCES seasons(id),
  league_id TEXT NOT NULL,
  week INT NOT NULL,
  roster_id INT NOT NULL,
  player_id TEXT NOT NULL,
  points NUMERIC(8,2) NOT NULL DEFAULT 0,
  is_starter BOOLEAN NOT NULL DEFAULT true,
  slot_position TEXT,
  fetched_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(league_id, week, roster_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_pws_season_week ON player_weekly_scores(season_id, week);
CREATE INDEX IF NOT EXISTS idx_pws_player ON player_weekly_scores(player_id, season_id);
