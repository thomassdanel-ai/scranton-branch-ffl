-- ============================================================
-- Migration 008: Schema Housekeeping (Phase 0)
-- - Drop legacy is_current column from seasons
-- - Add partial unique index: one active-ish season per org
-- - Document expanded season status lifecycle
-- ============================================================

-- 0.1: Remove legacy is_current column
-- All code now uses the status column exclusively.
ALTER TABLE seasons DROP COLUMN IF EXISTS is_current;

-- 0.2: Ensure only one non-terminal season per org at a time
-- (setup, registering, confirming, pre_draft, drafting, active, playoffs)
CREATE UNIQUE INDEX idx_seasons_one_active_per_org
  ON seasons (org_id)
  WHERE status NOT IN ('completed', 'archived');

-- 0.3: Document the expanded season status lifecycle
COMMENT ON COLUMN seasons.status IS
  'Lifecycle: setup → registering → confirming → pre_draft → drafting → active → playoffs → completed → archived';
