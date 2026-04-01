# EXECUTION_PLAN.md — Scranton Branch FFL Platform Evolution

> **This document is the master execution plan for the next phase of development.**
> It supersedes unchecked items in PROJECT_SPEC.md phases. Read this file BEFORE making changes.
> When in conflict with PROJECT_SPEC.md, this document wins.

---

## Guiding Principles

1. **Dependency order is law.** Each phase below has explicit prerequisites. Never start a phase until its prerequisites are marked complete. If you discover a prerequisite was missed, stop and fix it before continuing.

2. **Schema is the contract.** The database schema defined here is the source of truth for the data model. Implementation details (component structure, API route naming, UI layout) are flexible — pivot as needed. But every table, column, FK, and constraint specified here must be implemented exactly as described, because downstream phases depend on them.

3. **Cohorts are the core abstraction.** The platform is evolving from "one org, many leagues" to "one org, many cohorts, each with many leagues." A cohort is a group of people who sign up together, play together, and get recapped together. This is the single most important concept in this plan. Every feature should be cohort-aware.

4. **Sleeper is an input, not a dependency.** The cron sync is the ONLY code that calls Sleeper's API. Everything else reads from Supabase. If you find yourself importing from `lib/sleeper/api.ts` in any file other than `api/cron/sync/route.ts`, stop and refactor to read from cached DB data instead.

5. **The identity bridge matters.** Every row that describes a team's performance must be traceable back to a `member_seasons` record, which links to a `members` record. This is how cross-season career stats, the recap API, and the all-time records work. Sleeper roster IDs are transient (they change each season). Internal member UUIDs are permanent.

---

## Current State (as of April 2026)

### What's shipped (Phases 1-4, A-C)
- Next.js 14 app with Tailwind, Supabase, Vercel deployment
- Sleeper API client, cron sync, league snapshots, transaction caching
- Cross-league power rankings (computed from live Sleeper data)
- League explorer (standings, matchups), transactions feed
- Championship bracket engine (2-10+ teams)
- Admin panel with cookie-based single-password auth
- Members CRM (organizations, members, member_seasons tables)
- Season setup wizard (create season, intake, randomize leagues, draft order, Sleeper linking)
- Live draft board with Supabase Realtime
- Weekly results and player-level scoring tables
- RLS on all tables, security headers, rate-limited auth

### What's NOT shipped (gaps this plan addresses)
- Display layer still reads from Sleeper directly instead of cached DB data
- Power rankings don't join to member identity (uses Sleeper roster IDs, not member UUIDs)
- Player cache is a single 5MB JSONB blob
- Auth is single shared password (no multi-user, no scoped access)
- No cohort concept (can't run separate invite links / separate management)
- No signup funnel (registration → confirmation → waitlist)
- No league structure solver (manual math for league sizes)
- No recap API (Phase D not started)
- No newsletter system (Phase E not started)
- `seasons.is_current` column still exists alongside `seasons.status` (dual-identity bug risk)

---

## Phase 0: Schema Housekeeping

**Prerequisites:** None
**Goal:** Clean up schema inconsistencies that could cause bugs in later phases.

### 0.1 Remove `seasons.is_current` column

The `status` column (added in migration 003) is the source of truth. The legacy `is_current` boolean creates a dual-identity risk where they could disagree.

**Migration 008:**
```sql
-- First, ensure no code depends on is_current anymore
-- (check getActiveSeasonId in lib/config.ts — remove the fallback branch)
ALTER TABLE seasons DROP COLUMN IF EXISTS is_current;
```

**Code changes:**
- `src/lib/config.ts`: Remove the `is_current` fallback in `getActiveSeasonId()` and `getActiveSeasonYear()`. These should ONLY query by `status`.
- `src/lib/bracket/engine.ts`: Remove the `is_current` fallback in `loadBracket()` and `saveBracket()`.
- `src/app/api/cron/sync/route.ts`: Remove the `is_current: true` insert in `findSeasonId()`. If no active season exists, throw an error instead of creating one with `is_current`.

**Acceptance criteria:** `grep -r "is_current" src/` returns zero results.

### 0.2 Add season status constraint

Only one season per org should be in a non-terminal state at a time.

**Migration 008 (continued):**
```sql
-- Ensure only one active-ish season per org at a time
CREATE UNIQUE INDEX idx_seasons_one_active_per_org
  ON seasons (org_id)
  WHERE status NOT IN ('completed', 'archived');
```

### 0.3 Expand season status lifecycle

Add two new statuses for the signup funnel.

**New lifecycle:** `setup` → `registering` → `confirming` → `pre_draft` → `drafting` → `active` → `playoffs` → `completed` → `archived`

**Migration 008 (continued):**
```sql
-- No CHECK constraint needed (status is TEXT), but document the valid values.
-- The application layer enforces transitions via the setup wizard.
COMMENT ON COLUMN seasons.status IS
  'Lifecycle: setup → registering → confirming → pre_draft → drafting → active → playoffs → completed → archived';
```

**Validation:** Add a `VALID_SEASON_STATUSES` constant in `src/config/constants.ts` and use it in all status checks. Add a `validateStatusTransition(from, to)` utility in `src/lib/config.ts` that enforces the valid transitions.

---

## Phase 1: Admin Auth Upgrade

**Prerequisites:** Phase 0 complete
**Goal:** Replace the single shared password with multi-user admin accounts that support scoped access per cohort.

### 1.1 Create `admin_users` table

**Migration 009:**
```sql
CREATE TABLE admin_users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organizations(id),
  email           TEXT NOT NULL,
  display_name    TEXT NOT NULL,
  password_hash   TEXT NOT NULL,  -- bcrypt hash
  role            TEXT NOT NULL DEFAULT 'commissioner',
    -- 'super_admin': sees and manages everything
    -- 'commissioner': sees and manages only assigned cohorts
  is_active       BOOLEAN DEFAULT true,
  last_login_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, email)
);

ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Seed the super admin (T_Danel)
-- Password will be set via a setup endpoint or migration script
-- INSERT INTO admin_users (org_id, email, display_name, role, password_hash)
-- VALUES ((SELECT id FROM organizations WHERE slug = 'scranton-branch-ffl'),
--         '<commissioner_email>', 'T Dawg', 'super_admin', '<bcrypt_hash>');
```

### 1.2 Create `admin_sessions` table

Server-side session store. Replaces the `admin_auth=true` cookie with a proper session token.

**Migration 009 (continued):**
```sql
CREATE TABLE admin_sessions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  token       TEXT NOT NULL UNIQUE,  -- crypto.randomBytes(32).toString('hex')
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE admin_sessions ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_admin_sessions_token ON admin_sessions(token);
CREATE INDEX idx_admin_sessions_expires ON admin_sessions(expires_at);
```

### 1.3 Refactor auth system

**Install:** `npm install bcryptjs` (pure JS, no native bindings needed on Vercel)

**New files:**
- `src/lib/auth.ts` — REWRITE completely:
  - `hashPassword(plain)` → bcrypt hash
  - `verifyPassword(plain, hash)` → bcrypt compare
  - `createSession(userId)` → generates token, inserts into admin_sessions, sets httpOnly cookie `admin_session=<token>`, returns session
  - `getAuthUser()` → reads cookie, looks up session, checks expiry, returns `{ id, email, displayName, role, orgId }` or null
  - `requireAuth()` → calls getAuthUser(), throws 401 if null
  - `requireSuperAdmin()` → calls getAuthUser(), throws 403 if role !== 'super_admin'
  - Delete the old `isAuthed()` function entirely

- `src/app/api/admin/auth/route.ts` — REWRITE:
  - POST: accepts `{ email, password }`, verifies against admin_users, creates session
  - DELETE: destroys session (logout)
  - Keep rate limiting logic (it's good)

**Update ALL admin routes:** Replace `isAuthed()` calls with `await requireAuth()`. The return value gives you the authenticated user, which you'll need for cohort scoping in Phase 2.

**Environment variables:**
- Remove `ADMIN_PASSWORD` from .env.local.example (replaced by per-user passwords)
- Add a one-time setup flow or CLI script to create the first super_admin account

**Acceptance criteria:**
- `grep -r "isAuthed" src/` returns zero results
- `grep -r "ADMIN_PASSWORD" src/` returns zero results (except .env.local.example removal note)
- Login requires email + password
- Session token in httpOnly cookie, 24hr expiry
- Logout destroys server-side session

---

## Phase 2: Cohort System

**Prerequisites:** Phase 0 + Phase 1 complete
**Goal:** Introduce cohorts as the grouping layer between org/season and leagues. Support separate invite links, separate management, separate recaps.

### 2.1 Create `cohorts` table

**Migration 010:**
```sql
CREATE TABLE cohorts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organizations(id),
  season_id       UUID NOT NULL REFERENCES seasons(id),
  name            TEXT NOT NULL,            -- e.g. "Sales & Accounting", "Operations"
  slug            TEXT NOT NULL,            -- URL-safe, e.g. "sales-accounting"
  invite_token    TEXT NOT NULL UNIQUE,     -- crypto.randomBytes(16).toString('hex')
  color           TEXT DEFAULT '#1a73e8',
  status          TEXT NOT NULL DEFAULT 'open',
    -- 'open': accepting registrations
    -- 'closed': registration closed, awaiting confirmation
    -- 'confirmed': all slots filled, ready for league assignment
    -- 'active': leagues assigned, season in progress
  settings        JSONB DEFAULT '{}',       -- recap_prompt override, timezone, etc.
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(season_id, slug)
);

CREATE INDEX idx_cohorts_season ON cohorts(season_id);
CREATE INDEX idx_cohorts_invite ON cohorts(invite_token);

ALTER TABLE cohorts ENABLE ROW LEVEL SECURITY;
```

### 2.2 Add `cohort_id` to leagues

**Migration 010 (continued):**
```sql
ALTER TABLE leagues ADD COLUMN cohort_id UUID REFERENCES cohorts(id);

-- Existing leagues (pre-cohort) will have NULL cohort_id.
-- When the cohort system is used, all new leagues MUST have a cohort_id.
-- Queries that filter by cohort should use: WHERE cohort_id = $1
-- Queries that don't care about cohorts (backward compat) just skip the filter.

CREATE INDEX idx_leagues_cohort ON leagues(cohort_id);
```

### 2.3 Add `cohort_id` to related tables

**Migration 010 (continued):**
```sql
-- Power rankings are computed per cohort
ALTER TABLE power_rankings ADD COLUMN cohort_id UUID REFERENCES cohorts(id);

-- Brackets are per cohort
ALTER TABLE brackets ADD COLUMN cohort_id UUID REFERENCES cohorts(id);

-- Announcements can be cohort-scoped (NULL = org-wide)
ALTER TABLE announcements ADD COLUMN cohort_id UUID REFERENCES cohorts(id);

-- Newsletters/recaps are per cohort
ALTER TABLE newsletters ADD COLUMN cohort_id UUID REFERENCES cohorts(id);
```

### 2.4 Create `season_registrations` table

Tracks the signup funnel per cohort.

**Migration 010 (continued):**
```sql
CREATE TABLE season_registrations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id       UUID NOT NULL REFERENCES cohorts(id),
  member_id       UUID NOT NULL REFERENCES members(id),
  season_id       UUID NOT NULL REFERENCES seasons(id),
  status          TEXT NOT NULL DEFAULT 'registered',
    -- 'registered': signed up via invite link
    -- 'confirmed': confirmed participation
    -- 'waitlisted': over capacity, in queue
    -- 'promoted': moved from waitlist to confirmed
    -- 'declined': opted out or no-showed confirmation window
  waitlist_position INT,                    -- NULL unless waitlisted
  registered_at   TIMESTAMPTZ DEFAULT now(),
  confirmed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(cohort_id, member_id)              -- one registration per cohort per person
);

CREATE INDEX idx_registrations_cohort ON season_registrations(cohort_id);
CREATE INDEX idx_registrations_status ON season_registrations(cohort_id, status);

ALTER TABLE season_registrations ENABLE ROW LEVEL SECURITY;

-- Allow anon INSERT for self-registration (invite link flow)
-- The invite_token validation happens in the API route, not RLS
CREATE POLICY "anon_register"
  ON season_registrations
  FOR INSERT
  TO anon
  WITH CHECK (true);
```

### 2.5 Create `admin_cohort_assignments` join table

Maps commissioners to the cohorts they can manage.

**Migration 010 (continued):**
```sql
CREATE TABLE admin_cohort_assignments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id   UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  cohort_id       UUID NOT NULL REFERENCES cohorts(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(admin_user_id, cohort_id)
);

ALTER TABLE admin_cohort_assignments ENABLE ROW LEVEL SECURITY;
```

### 2.6 Implement cohort-scoped admin middleware

**New file:** `src/lib/auth-scope.ts`
```typescript
// Pseudocode — implement fully
export async function getCohortScope(userId: string): Promise<string[] | 'all'> {
  // If super_admin → return 'all'
  // Otherwise → query admin_cohort_assignments → return array of cohort IDs
}

export async function requireCohortAccess(userId: string, cohortId: string): Promise<void> {
  const scope = await getCohortScope(userId);
  if (scope === 'all') return;
  if (!scope.includes(cohortId)) throw new Error('Forbidden');
}
```

**Update all admin routes** to accept an optional `cohortId` parameter and check scope.

### 2.7 Build the signup funnel

**New API routes:**
- `POST /api/register` — public, accepts `{ inviteToken, fullName, email }`. Validates token against cohorts table, creates member record if new, creates season_registration with status='registered'. No auth required.
- `GET /api/register/[token]` — public, returns cohort info (name, season, deadline) for the registration page. No member data exposed.

**New public page:**
- `src/app/register/[token]/page.tsx` — simple registration form. Shows cohort name, season info, deadline. Collects name and email. Submits to POST /api/register.

**New admin routes:**
- `GET /api/admin/cohorts` — list cohorts for current season (scoped)
- `POST /api/admin/cohorts` — create a cohort (generates invite_token)
- `PUT /api/admin/cohorts/[id]` — update cohort (close registration, etc.)
- `GET /api/admin/cohorts/[id]/registrations` — list registrations for a cohort
- `POST /api/admin/cohorts/[id]/confirm` — send confirmation requests
- `POST /api/admin/cohorts/[id]/promote` — promote waitlisted members

**Acceptance criteria:**
- Commissioner creates a cohort and gets an invite link
- Anyone with the link can register (no account needed)
- Commissioner sees live registration count
- Commissioner can close registration
- Registration status flows: registered → confirmed/waitlisted/declined

---

## Phase 3: League Structure Solver

**Prerequisites:** Phase 2 complete (cohort system exists)
**Goal:** Given N confirmed participants in a cohort, recommend optimal league configurations.

### 3.1 Implement the solver algorithm

**New file:** `src/lib/solver/league-solver.ts`

```typescript
// Pseudocode — implement fully
type LeagueConfig = {
  leagueCount: number;
  sizes: number[];           // e.g. [10, 10, 10, 8]
  totalSlots: number;        // sum of sizes
  overage: number;           // totalSlots - N (negative = need more people)
  score: number;             // preference score (higher = better)
  description: string;       // human-readable, e.g. "3 leagues of 10 + 1 league of 8"
};

export function solveLeagueStructure(
  confirmedCount: number,
  options?: {
    preferredSize?: number;     // default 10
    allowedSizes?: number[];    // default [8, 10, 12]
    maxLeagues?: number;        // default 20
  }
): LeagueConfig[];
```

**Scoring heuristic:**
- Maximize leagues at preferred size (10): +10 points per league at preferred size
- Penalize size variance: -5 points for each league not at preferred size
- Penalize mixed sizes: -3 points if more than 2 distinct sizes are used
- Penalize overage/underage: -2 points per person over/under
- Exact fit bonus: +20 points if totalSlots === confirmedCount

**Return:** Top 5 configurations, sorted by score descending.

### 3.2 Integrate solver into setup wizard

**Update:** `src/app/admin/season-setup/page.tsx`

After registration closes, the setup wizard shows:
1. Confirmed count per cohort
2. Solver recommendations (top 3-5 options)
3. Commissioner picks one
4. System creates league records with the chosen sizes
5. Fisher-Yates shuffle proceeds as before, but now uses variable league sizes from the chosen config

**Update:** `src/app/api/admin/setup/leagues/route.ts`
- Accept a `leagueConfig` parameter (array of `{ name, size }`)
- Round-robin shuffle deals members into leagues respecting variable sizes
- Validate that total slots = confirmed member count for the cohort

---

## Phase 4: Identity Bridge

**Prerequisites:** Phase 0 complete (schema housekeeping)
**Goal:** Connect the display layer to member identity so every team result traces back to a permanent member UUID.

> **IMPORTANT:** This phase has no dependency on Phases 1-3. It can run in parallel with the cohort/auth work. It IS a prerequisite for Phases 6 and 7 (Recap API, Newsletter).

### 4.1 Add `member_season_id` to `weekly_results`

**Migration 011:**
```sql
ALTER TABLE weekly_results
  ADD COLUMN member_season_id UUID REFERENCES member_seasons(id);

CREATE INDEX idx_weekly_results_member_season ON weekly_results(member_season_id);
```

This column is nullable because historical rows won't have it until backfilled. New rows written by the cron sync should populate it.

### 4.2 Add `member_season_id` to `player_weekly_scores`

**Migration 011 (continued):**
```sql
ALTER TABLE player_weekly_scores
  ADD COLUMN member_season_id UUID REFERENCES member_seasons(id);

CREATE INDEX idx_pws_member_season ON player_weekly_scores(member_season_id);
```

### 4.3 Build the member_season resolver

**New file:** `src/lib/member-resolver.ts`

```typescript
// Given a Sleeper league_id and roster_id, find the member_season record.
// Used by the cron sync to populate member_season_id on weekly_results.
export async function resolveMemberSeason(
  seasonId: string,
  sleeperLeagueId: string,
  sleeperRosterId: number
): Promise<string | null> {
  // 1. Find the league record by sleeper_league_id and season_id
  // 2. Find the member_season by league_id and sleeper_roster_id
  // 3. Return member_season.id or null
}

// Batch version for cron efficiency
export async function resolveMemberSeasonsBatch(
  seasonId: string,
  sleeperLeagueId: string
): Promise<Map<number, string>> {
  // Returns Map<roster_id, member_season_id>
}
```

### 4.4 Update cron sync to populate `member_season_id`

**Update:** `src/app/api/cron/sync/route.ts`
- After fetching matchups, resolve member_season IDs using the batch resolver
- Pass them into `buildWeeklyResults()` and `buildPlayerScores()`
- These functions should include `member_season_id` in their output rows

**Update:** `src/lib/weekly-results.ts`
- `buildWeeklyResults()` accepts an optional `memberSeasonMap: Map<number, string>` parameter
- If provided, each row gets `member_season_id: memberSeasonMap.get(roster_id) ?? null`
- Same for `buildPlayerScores()`

### 4.5 Backfill existing `weekly_results` rows

**New admin route:** `POST /api/admin/backfill-identity`
- For each weekly_results row where member_season_id IS NULL
- Resolve via league_id + roster_id → member_seasons.sleeper_roster_id
- Update the row

### 4.6 Refactor `computePowerRankings()` to use DB data

**CRITICAL CHANGE.** This is the core of "Sleeper is an input, not a dependency."

**Rewrite:** `src/lib/rankings/compute.ts`
- Instead of calling `getLeagueTeams()` (which hits Sleeper), query `weekly_results` for the current season
- Join through `member_seasons` → `members` to get display names
- Join through `leagues` to get league name/color
- Compute win%, PF percentile, luck index, and streak from the `weekly_results` rows
- The expected wins calculation uses `weekly_results.points` cross-compared across all teams per week

**Why this matters:** Rankings now work from historical data, not live Sleeper calls. This means:
- Rankings can be computed retroactively for any past week
- Rankings work during off-season without Sleeper
- Rankings include member display_name (from the member table, not Sleeper)
- No redundant Sleeper API calls outside the cron

### 4.7 Update display components

- `StandingsTable`: Show `members.display_name` (via member_seasons join) alongside Sleeper team name
- `MatchupCard`: Same
- `PowerRankingsTable`: Use the member display_name from the new rankings computation
- `TransactionsFeed`: Resolve roster IDs to member names via member_seasons
- `BracketView`: Use member identity for team labels

**Acceptance criteria:**
- `grep -r "getLeagueTeams\|getLeagueRosters\|getLeagueUsers" src/` returns results ONLY in `src/lib/sleeper/api.ts` and `src/app/api/cron/sync/route.ts`
- Power rankings page shows member display_names
- All weekly_results rows for the current season have member_season_id populated

---

## Phase 5: Normalize Player Cache

**Prerequisites:** Phase 0 complete
**Goal:** Replace the 5MB JSONB blob with a proper lookup table.

> **Can run in parallel with Phases 1-4.** Is a prerequisite for Phase 6 (Recap API).

### 5.1 Create `players_normalized` table

**Migration 012:**
```sql
CREATE TABLE players_normalized (
  player_id   TEXT PRIMARY KEY,             -- Sleeper player ID
  full_name   TEXT NOT NULL,
  first_name  TEXT,
  last_name   TEXT,
  position    TEXT,                          -- QB, RB, WR, TE, K, DEF
  team        TEXT,                          -- NFL team abbreviation (NULL if free agent)
  status      TEXT,                          -- active, inactive, injured_reserve
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- No RLS needed — this is public reference data
-- But enable it for consistency, with anon SELECT policy
ALTER TABLE players_normalized ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_select_players"
  ON players_normalized FOR SELECT TO anon USING (true);
```

### 5.2 Update daily player sync

**Update:** `src/app/api/cron/sync/route.ts` (or create a separate cron endpoint)
- Fetch the full Sleeper player database (`GET /players/nfl`)
- Transform into rows and UPSERT into `players_normalized`
- Only run this once per day (check `fetched_at` on any row, skip if < 24hr old)

### 5.3 Refactor `src/lib/players/cache.ts`

Replace the 3-tier cache (memory → JSONB blob → Sleeper) with:
1. In-memory Map (10min TTL) — same as before
2. `SELECT full_name, position, team FROM players_normalized WHERE player_id = $1` — single row, instant
3. Sleeper API fallback — only if the player isn't in the normalized table (rare edge case for brand-new players)

### 5.4 Deprecate `players_cache` table

After confirming `players_normalized` is stable and populated:
- Remove all references to `players_cache` in code
- Add a migration to drop the table (or leave it and just stop writing to it)

**Acceptance criteria:**
- `SELECT count(*) FROM players_normalized` returns 10000+ rows
- Player lookups resolve in < 10ms from Supabase (vs. loading a 5MB blob)
- `grep -r "players_cache" src/` returns zero results in application code

---

## Phase 6: Recap Data API ("The Dundie Report")

**Prerequisites:** Phase 4 (identity bridge) + Phase 5 (player cache) complete
**Goal:** API endpoints that provide rich, structured data for AI-generated weekly recaps.

### 6.1 New API routes

All recap endpoints require Bearer token auth (`RECAP_API_KEY` env var).

**`GET /api/recap/weekly?seasonId=X&week=N&cohortId=Y`**

Returns a comprehensive weekly payload:
```typescript
{
  season: { year, weekNumber, status },
  cohort: { name, leagueCount },
  matchups: [{
    league: { name, color },
    team1: { memberName, teamName, points, record, streak },
    team2: { memberName, teamName, points, record, streak },
    result: 'win' | 'loss' | 'tie',
    margin: number,
    isUpset: boolean,  // lower-ranked team won
  }],
  standings: [{ memberName, teamName, league, record, pointsFor, rank }],
  powerRankings: [{ memberName, rank, previousRank, movement, powerScore }],
  transactions: [{ type, league, memberName, adds, drops, timestamp }],
  notableStats: {
    highestScore: { memberName, points, league },
    lowestScore: { memberName, points, league },
    biggestUpset: { winner, loser, margin },
    closestGame: { team1, team2, margin },
    bestBenchPlayer: { memberName, playerName, points },
    worstStarterDecision: { memberName, benchedPlayer, benchPoints, startedPlayer, startedPoints },
  },
}
```

**`GET /api/recap/season-summary?seasonId=X&cohortId=Y`**

End-of-season stats, awards, champion info. Used for the season finale recap.

**`GET /api/recap/member-profile?memberId=X`**

Career deep dive: all seasons, all leagues, record, transaction count, draft picks, power ranking history. Cross-season stats powered by the member identity bridge.

### 6.2 Recap prompt configuration

Store the default AI persona/system prompt in `organizations.settings.recap_prompt`.

**Default persona:** "The Dundie Report" — an AI columnist channeling Matthew Berry's style with recurring segments: Cold Open, Matchup Breakdown, Power Rankings Movement, Trade of the Week, Waiver Wire Hero, The Toby Award (worst decision of the week), Bold Predictions.

The prompt should be configurable per cohort via `cohorts.settings.recap_prompt` (overrides the org default). This allows different cohorts to have different recap personalities.

### 6.3 Environment variables

Add to `.env.local.example`:
```
RECAP_API_KEY=              # Bearer token for /api/recap/* endpoints
ANTHROPIC_API_KEY=          # For in-app recap generation (Phase 7)
```

---

## Phase 7: Newsletter + In-App Recaps

**Prerequisites:** Phase 6 complete
**Goal:** Full content pipeline — generate, edit, publish, deliver.

### 7.1 Admin recap management

**New admin page:** `src/app/admin/recaps/page.tsx`
- List all recaps for the current season (per cohort)
- "Generate Recap" button → calls Anthropic API server-side with the weekly data from Phase 6 endpoint + the cohort's recap prompt
- Rich text editor for post-generation editing
- "Publish" button → saves to newsletters table, makes it visible on public recaps page
- "Send" button → sends via Resend to all members in the cohort with email addresses

### 7.2 Public recaps archive

**New public page:** `src/app/recaps/page.tsx`
- Lists published recaps chronologically
- Filterable by cohort (if multiple cohorts exist)
- Click to view full HTML recap in a styled reading view

### 7.3 Resend integration

**Update:** Wire up Resend for newsletter delivery
- Pull recipient list from `members.email` via `member_seasons` for the cohort
- HTML email template that renders the recap content
- Track sent_at on the newsletters table

---

## Phase 8: Cron Sync Optimization

**Prerequisites:** Phase 4 (pipeline consolidation) complete
**Goal:** Ensure the cron sync scales to 10+ leagues efficiently.

### 8.1 Parallel Sleeper fetches

**Update:** `src/app/api/cron/sync/route.ts`
- Replace the sequential `for (const league of leagues)` loop with `Promise.allSettled()`
- Fetch all leagues' data concurrently (rosters, matchups, transactions in parallel per league)
- Sleeper allows 1000 calls/min; even 10 leagues × 3 endpoints = 30 calls is well within limits

### 8.2 Batch Supabase upserts

- Collect all snapshot rows across all leagues, then do a single `supabase.from('league_snapshots').upsert(allRows)`
- Same for transactions_cache and weekly_results
- This reduces Supabase round-trips from O(N leagues) to O(1)

### 8.3 Conditional rankings computation

- Only recompute power rankings if any league_snapshot actually changed (compare fetched_at or a content hash)
- Or compute rankings on a separate cadence (every 15 min instead of every 5)

### 8.4 Monitor Vercel function duration

- Vercel free tier: 10 second timeout per serverless function
- If the sync exceeds 8 seconds with 10+ leagues, split into:
  - `/api/cron/sync` — data fetch and cache only
  - `/api/cron/compute` — rankings and weekly results computation
  - Both run on the same cron schedule but as separate functions

---

## Phase 9: Polish & Remaining Items

**Prerequisites:** None (can run in parallel with any phase)
**Goal:** Ship the remaining unchecked items from the original PROJECT_SPEC.

- [ ] Historical season archives + season archival flow
- [ ] Zod schema validation on bracket writes (security audit item #10)
- [ ] Loading states and animations (paper airplane, confetti for champion)
- [ ] Error boundaries and offline handling
- [ ] SEO and Open Graph meta tags
- [ ] Supabase Realtime for live score updates on matchup pages
- [ ] 404 page easter egg ("That's what she said" / "I declare bankruptcy")

---

## Dependency Map

```
Phase 0 (Schema Housekeeping)
  │
  ├──→ Phase 1 (Admin Auth) ──→ Phase 2 (Cohorts) ──→ Phase 3 (Solver)
  │
  ├──→ Phase 4 (Identity Bridge) ──→ Phase 6 (Recap API) ──→ Phase 7 (Newsletter)
  │                                        ↑
  ├──→ Phase 5 (Player Cache) ────────────┘
  │
  └──→ Phase 8 (Cron Optimization) [after Phase 4]

Phase 9 (Polish) — no hard dependencies, runs in parallel
```

**Critical path for signup funnel (June-July deadline):** 0 → 1 → 2 → 3
**Critical path for recap API:** 0 → 4 + 5 → 6 → 7

These two paths can run in parallel since they share only Phase 0 as a common prerequisite.

---

## Migration Summary

| Migration | Phase | Tables/Changes |
|-----------|-------|----------------|
| 008 | 0 | Drop `is_current`, add season status constraint, lifecycle comment |
| 009 | 1 | Create `admin_users`, `admin_sessions` |
| 010 | 2 | Create `cohorts`, `season_registrations`, `admin_cohort_assignments`; add `cohort_id` to leagues, power_rankings, brackets, announcements, newsletters |
| 011 | 4 | Add `member_season_id` to weekly_results and player_weekly_scores |
| 012 | 5 | Create `players_normalized` |

---

## Environment Variables (Final State)

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Cron
CRON_SECRET=

# Recap
RECAP_API_KEY=
ANTHROPIC_API_KEY=

# Email
RESEND_API_KEY=
RESEND_FROM_EMAIL=

# Optional (remove if not using)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

Note: `ADMIN_PASSWORD` is removed. Admin auth is now per-user via `admin_users` table.

---

## Invariants (Never Violate These)

1. **Only the cron sync calls Sleeper.** Every other file reads from Supabase.
2. **Every team result has a `member_season_id`.** New rows must populate it. Historical rows get backfilled.
3. **Admin routes check scope.** `requireAuth()` + cohort scope check on every admin endpoint.
4. **One active season per org.** Enforced by the partial unique index on `seasons`.
5. **Cohort_id is nullable on legacy tables.** Pre-cohort data has `cohort_id = NULL`. New data written through the cohort system MUST set it. Queries should handle both cases gracefully.
6. **The solver is a recommendation, not a mandate.** The commissioner always has the final say on league structure. The solver presents options; the human picks.
7. **Invite tokens are secrets.** Treat them like API keys. Don't expose them in URLs that get logged (use POST bodies or short-lived signed URLs).
8. **Recaps are per-cohort.** The recap API always requires a cohort_id. There is no "global" recap (unless the commissioner explicitly wants one, which would be a future feature).
