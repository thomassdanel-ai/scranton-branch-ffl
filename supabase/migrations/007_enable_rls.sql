-- ============================================================
-- Migration 007: Enable Row-Level Security on all tables
-- Resolves Supabase security advisor warning about publicly
-- accessible tables. Service role key bypasses RLS, so all
-- server-side API routes continue working unchanged.
-- ============================================================

-- 1. Enable RLS on every table (denies all anon access by default)

ALTER TABLE seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE league_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE power_rankings ENABLE ROW LEVEL SECURITY;
ALTER TABLE brackets ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE newsletters ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE players_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE season_archives ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE draft_boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE draft_picks ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_weekly_scores ENABLE ROW LEVEL SECURITY;

-- 2. Allow anon SELECT on draft_picks (required for Realtime subscriptions
--    used by the public draft board at /draft/[boardId])

CREATE POLICY "anon_select_draft_picks"
  ON draft_picks
  FOR SELECT
  TO anon
  USING (true);
