-- Migration 006: Add color, short_name, position to leagues table
-- Enables DB-driven league config instead of hardcoded file

ALTER TABLE leagues ADD COLUMN IF NOT EXISTS color TEXT;
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS short_name TEXT;
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS position INT DEFAULT 0;

-- Backfill existing leagues (2025 season)
UPDATE leagues SET color = '#3b82f6', short_name = 'Sales', position = 0
WHERE name = 'Sales' AND color IS NULL;

UPDATE leagues SET color = '#10b981', short_name = 'Acct', position = 1
WHERE name = 'Accounting' AND color IS NULL;
