-- Migration 014: Sleeper Draft Sync
-- Links draft boards to Sleeper drafts and adds dedup key to draft_picks

-- Link draft boards to Sleeper drafts
ALTER TABLE draft_boards ADD COLUMN sleeper_draft_id TEXT;
CREATE INDEX idx_draft_boards_sleeper ON draft_boards(sleeper_draft_id);

-- Add sleeper_pick_id to draft_picks for dedup during sync
ALTER TABLE draft_picks ADD COLUMN sleeper_pick_id TEXT;
CREATE UNIQUE INDEX idx_draft_picks_sleeper ON draft_picks(sleeper_pick_id) WHERE sleeper_pick_id IS NOT NULL;

-- Track when a board was last synced from Sleeper
ALTER TABLE draft_boards ADD COLUMN last_synced_at TIMESTAMPTZ;
