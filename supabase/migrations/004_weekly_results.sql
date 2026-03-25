-- Weekly results: one row per team per week (append-only, never overwritten)
-- This is the core data layer for recaps, historical analysis, and the AI columnist
CREATE TABLE weekly_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID REFERENCES seasons(id),
  league_id TEXT NOT NULL,
  week INT NOT NULL,
  roster_id INT NOT NULL,
  -- Result
  points NUMERIC(8,2) NOT NULL DEFAULT 0,
  opponent_roster_id INT,
  opponent_points NUMERIC(8,2),
  result TEXT CHECK (result IN ('win', 'loss', 'tie')),
  matchup_id INT,
  -- Season-to-date snapshot at this week
  season_wins INT NOT NULL DEFAULT 0,
  season_losses INT NOT NULL DEFAULT 0,
  season_ties INT NOT NULL DEFAULT 0,
  season_points_for NUMERIC(10,2) NOT NULL DEFAULT 0,
  season_points_against NUMERIC(10,2) NOT NULL DEFAULT 0,
  streak TEXT, -- e.g. "3W", "2L"
  -- Metadata
  is_playoff BOOLEAN DEFAULT false,
  is_bracket BOOLEAN DEFAULT false, -- custom bracket matchup (not from Sleeper)
  bracket_round TEXT, -- e.g. "W1-SALES", "FINAL"
  fetched_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(league_id, week, roster_id)
);

CREATE INDEX idx_weekly_results_season ON weekly_results(season_id);
CREATE INDEX idx_weekly_results_league_week ON weekly_results(league_id, week);
CREATE INDEX idx_weekly_results_roster ON weekly_results(league_id, roster_id);
