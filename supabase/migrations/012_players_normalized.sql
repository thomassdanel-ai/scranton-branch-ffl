-- ============================================================
-- Migration 012: Normalized Player Cache (Phase 5)
-- Replaces the 5MB JSONB blob in players_cache with a proper
-- lookup table for efficient per-player queries.
-- ============================================================

CREATE TABLE players_normalized (
  player_id   TEXT PRIMARY KEY,
  full_name   TEXT NOT NULL,
  first_name  TEXT,
  last_name   TEXT,
  position    TEXT,
  team        TEXT,
  status      TEXT,
  updated_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE players_normalized ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_select_players"
  ON players_normalized
  FOR SELECT
  TO anon
  USING (true);
