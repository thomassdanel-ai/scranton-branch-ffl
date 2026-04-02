-- Migration 013: Enable Realtime on league_snapshots for live score updates
-- Phase 9 Polish: Live score updates on matchup pages

-- Allow anon SELECT on league_snapshots so browser clients can subscribe via Realtime
CREATE POLICY "anon_select_snapshots"
  ON league_snapshots
  FOR SELECT
  TO anon
  USING (true);

-- Note: league_snapshots must also be added to the Realtime publication
-- via the Supabase Dashboard > Database > Replication, or by running:
-- ALTER PUBLICATION supabase_realtime ADD TABLE league_snapshots;
