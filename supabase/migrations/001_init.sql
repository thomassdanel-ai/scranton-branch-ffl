-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- League configuration (persisted per-season)
CREATE TABLE seasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year TEXT NOT NULL,
  is_current BOOLEAN DEFAULT false,
  config JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Cached Sleeper league data
CREATE TABLE league_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID REFERENCES seasons(id),
  league_id TEXT NOT NULL,
  week INT NOT NULL,
  standings JSONB NOT NULL,
  matchups JSONB NOT NULL,
  fetched_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(league_id, week)
);

-- Cross-league power rankings (computed)
CREATE TABLE power_rankings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID REFERENCES seasons(id),
  week INT NOT NULL,
  rankings JSONB NOT NULL,
  computed_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(season_id, week)
);

-- Championship bracket
CREATE TABLE brackets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID REFERENCES seasons(id),
  bracket_data JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Commissioner announcements
CREATE TABLE announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  pinned BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Newsletter recaps
CREATE TABLE newsletters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID REFERENCES seasons(id),
  week INT,
  subject TEXT NOT NULL,
  html_content TEXT NOT NULL,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Email subscribers
CREATE TABLE subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Transactions cache (for the unified feed)
CREATE TABLE transactions_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID REFERENCES seasons(id),
  league_id TEXT NOT NULL,
  week INT NOT NULL,
  transactions JSONB NOT NULL,
  fetched_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(league_id, week)
);

-- NFL player data cache (refreshed daily)
CREATE TABLE players_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data JSONB NOT NULL,
  fetched_at TIMESTAMPTZ DEFAULT now()
);

-- Historical season archives
CREATE TABLE season_archives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID REFERENCES seasons(id),
  final_standings JSONB NOT NULL,
  champion JSONB,
  awards JSONB,
  archived_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX idx_league_snapshots_league_week ON league_snapshots(league_id, week);
CREATE INDEX idx_transactions_cache_league_week ON transactions_cache(league_id, week);
CREATE INDEX idx_power_rankings_season_week ON power_rankings(season_id, week);
CREATE INDEX idx_announcements_created ON announcements(created_at DESC);
CREATE INDEX idx_newsletters_created ON newsletters(created_at DESC);
