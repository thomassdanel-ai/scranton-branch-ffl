-- Migration 015: Enrollment tracking columns
-- Adds Sleeper username to members, invite link + enrollment check timestamp to leagues,
-- and enrollment status + email tracking to member_seasons.

-- Members: store Sleeper username for auto-matching
ALTER TABLE members ADD COLUMN IF NOT EXISTS sleeper_username TEXT;
CREATE INDEX IF NOT EXISTS idx_members_sleeper_username ON members (org_id, sleeper_username);

-- Leagues: store Sleeper invite link and last enrollment check time
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS sleeper_invite_link TEXT;
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS last_enrollment_check_at TIMESTAMPTZ;

-- Member seasons: enrollment tracking
ALTER TABLE member_seasons ADD COLUMN IF NOT EXISTS enrollment_status TEXT DEFAULT 'pending';
ALTER TABLE member_seasons ADD COLUMN IF NOT EXISTS invite_sent_at TIMESTAMPTZ;
ALTER TABLE member_seasons ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ;
