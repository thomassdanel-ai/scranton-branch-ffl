-- ============================================================
-- Migration 010: Cohort System (Phase 2)
-- Creates cohorts, season_registrations, admin_cohort_assignments.
-- Adds cohort_id FK to leagues, power_rankings, brackets,
-- announcements, newsletters.
-- ============================================================

-- 1. Cohorts table
CREATE TABLE cohorts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organizations(id),
  season_id       UUID NOT NULL REFERENCES seasons(id),
  name            TEXT NOT NULL,
  slug            TEXT NOT NULL,
  invite_token    TEXT NOT NULL UNIQUE,
  color           TEXT DEFAULT '#1a73e8',
  status          TEXT NOT NULL DEFAULT 'open',
  settings        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(season_id, slug)
);

CREATE INDEX idx_cohorts_season ON cohorts(season_id);
CREATE INDEX idx_cohorts_invite ON cohorts(invite_token);
ALTER TABLE cohorts ENABLE ROW LEVEL SECURITY;

-- 2. Add cohort_id to leagues
ALTER TABLE leagues ADD COLUMN cohort_id UUID REFERENCES cohorts(id);
CREATE INDEX idx_leagues_cohort ON leagues(cohort_id);

-- 3. Add cohort_id to related tables
ALTER TABLE power_rankings ADD COLUMN cohort_id UUID REFERENCES cohorts(id);
ALTER TABLE brackets ADD COLUMN cohort_id UUID REFERENCES cohorts(id);
ALTER TABLE announcements ADD COLUMN cohort_id UUID REFERENCES cohorts(id);
ALTER TABLE newsletters ADD COLUMN cohort_id UUID REFERENCES cohorts(id);

-- 4. Season registrations (signup funnel)
CREATE TABLE season_registrations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id       UUID NOT NULL REFERENCES cohorts(id),
  member_id       UUID NOT NULL REFERENCES members(id),
  season_id       UUID NOT NULL REFERENCES seasons(id),
  status          TEXT NOT NULL DEFAULT 'registered',
  waitlist_position INT,
  registered_at   TIMESTAMPTZ DEFAULT now(),
  confirmed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(cohort_id, member_id)
);

CREATE INDEX idx_registrations_cohort ON season_registrations(cohort_id);
CREATE INDEX idx_registrations_status ON season_registrations(cohort_id, status);
ALTER TABLE season_registrations ENABLE ROW LEVEL SECURITY;

-- Allow anon INSERT for self-registration (invite link flow)
CREATE POLICY "anon_register"
  ON season_registrations
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- 5. Admin-cohort assignments (scoped access)
CREATE TABLE admin_cohort_assignments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id   UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  cohort_id       UUID NOT NULL REFERENCES cohorts(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(admin_user_id, cohort_id)
);

ALTER TABLE admin_cohort_assignments ENABLE ROW LEVEL SECURITY;
