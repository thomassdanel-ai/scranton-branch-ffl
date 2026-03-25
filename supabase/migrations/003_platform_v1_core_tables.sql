-- ============================================================
-- Migration 003: Platform v1 Core Tables
-- Adds: organizations, members, leagues, member_seasons,
--        draft_boards, draft_picks
-- Updates: seasons (add org_id, season_number, status columns)
-- ============================================================

-- 1. Organizations (single row for now — Scranton Branch FFL)
CREATE TABLE organizations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  slug            TEXT NOT NULL UNIQUE,
  commissioner_email TEXT,
  settings        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- Seed the one org
INSERT INTO organizations (name, slug, settings)
VALUES (
  'Scranton Branch Fantasy Football League',
  'scranton-branch-ffl',
  '{"timezone": "America/New_York"}'
);

-- 2. Members
CREATE TABLE members (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organizations(id),
  full_name       TEXT NOT NULL,
  display_name    TEXT,
  email           TEXT,
  status          TEXT NOT NULL DEFAULT 'active',
  joined_season   INT,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, email)
);

CREATE INDEX idx_members_org_status ON members(org_id, status);

-- 3. Alter existing seasons table (additive — no data loss)
ALTER TABLE seasons
  ADD COLUMN org_id          UUID REFERENCES organizations(id),
  ADD COLUMN season_number   INT,
  ADD COLUMN status          TEXT DEFAULT 'active',
  ADD COLUMN num_leagues     INT DEFAULT 2,
  ADD COLUMN roster_size_per_league INT DEFAULT 10,
  ADD COLUMN settings        JSONB DEFAULT '{}',
  ADD COLUMN updated_at      TIMESTAMPTZ DEFAULT now();

-- Backfill org_id on existing season rows
UPDATE seasons
SET org_id = (SELECT id FROM organizations WHERE slug = 'scranton-branch-ffl');

-- 4. Leagues (per-season, replaces hard-coded config for DB operations)
CREATE TABLE leagues (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organizations(id),
  season_id       UUID NOT NULL REFERENCES seasons(id),
  name            TEXT NOT NULL,
  sleeper_league_id TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(season_id, name)
);

CREATE INDEX idx_leagues_season ON leagues(season_id);

-- 5. Member Seasons (the join table)
CREATE TABLE member_seasons (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id       UUID NOT NULL REFERENCES members(id),
  season_id       UUID NOT NULL REFERENCES seasons(id),
  league_id       UUID NOT NULL REFERENCES leagues(id),
  sleeper_roster_id TEXT,
  sleeper_display_name TEXT,
  draft_position  INT,
  onboard_status  TEXT DEFAULT 'pending',
  created_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(member_id, season_id)
);

CREATE INDEX idx_member_seasons_season ON member_seasons(season_id);
CREATE INDEX idx_member_seasons_league ON member_seasons(league_id);

-- 6. Draft Boards
CREATE TABLE draft_boards (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id       UUID NOT NULL REFERENCES leagues(id),
  season_id       UUID NOT NULL REFERENCES seasons(id),
  status          TEXT NOT NULL DEFAULT 'pending',
  num_rounds      INT NOT NULL DEFAULT 15,
  seconds_per_pick INT DEFAULT 90,
  current_round   INT DEFAULT 1,
  current_pick    INT DEFAULT 1,
  is_mock         BOOLEAN DEFAULT false,
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(league_id, season_id)
);

-- 7. Draft Picks
CREATE TABLE draft_picks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_board_id  UUID NOT NULL REFERENCES draft_boards(id),
  member_season_id UUID NOT NULL REFERENCES member_seasons(id),
  round           INT NOT NULL,
  pick_in_round   INT NOT NULL,
  overall_pick    INT NOT NULL,
  player_name     TEXT,
  player_id       TEXT,
  position        TEXT,
  picked_at       TIMESTAMPTZ,
  is_keeper       BOOLEAN DEFAULT false,
  UNIQUE(draft_board_id, round, pick_in_round),
  UNIQUE(draft_board_id, overall_pick)
);

CREATE INDEX idx_draft_picks_board ON draft_picks(draft_board_id);

-- 8. Enable Realtime on draft_picks for live draft board
ALTER PUBLICATION supabase_realtime ADD TABLE draft_picks;
