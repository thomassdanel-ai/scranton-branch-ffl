# Scranton Branch Fantasy Football League

**GitHub:** https://github.com/thomassdanel-ai/scranton-branch-ffl

A fantasy football league management platform for a friend group. Cross-league power rankings, live draft boards, championship bracket, transaction feeds, commissioner admin dashboard, cohort management, and AI-powered recaps.

## Tech Stack

- **Framework:** Next.js 14 (App Router), React 18, TypeScript 5
- **Database:** Supabase (PostgreSQL + Realtime)
- **Styling:** Tailwind CSS 3.4
- **Validation:** Zod (runtime schema validation on API inputs)
- **Animation:** Framer Motion (available), CSS animations (loading skeletons, page transitions)
- **External API:** Sleeper.app (league data, matchups, transactions, players)
- **Email:** Resend (configured, not actively used)
- **Cache:** Upstash Redis (configured, not actively used)
- **Deployment:** Vercel (serverless + cron)

## Directory Structure

```
src/
  app/                        # Next.js App Router
    (public pages)/           # /, /rankings, /bracket, /transactions, /history, /recaps
    admin/                    # Commissioner dashboard pages
    leagues/[leagueId]/       # League standings + matchups (with Realtime live scores)
    draft/[boardId]/          # Live draft board (Realtime)
    register/[token]/         # Public cohort registration page
    api/
      admin/                  # Protected admin endpoints (requireAuth)
      admin/cohorts/          # Cohort CRUD + registration management
      admin/backfill-identity/# Backfill member_season_id on historical rows
      admin/recaps/           # Recap generation + publishing
      cron/sync/              # Daily Sleeper data sync (parallel + batch)
      draft/                  # Public draft board data
      rankings/               # Public power rankings
      history/                # Public season archives
      recap/                  # Recap data API (Bearer token auth)
      register/[token]/       # Public cohort registration
    error.tsx                 # Global error boundary
    loading.tsx               # Global loading skeleton
    not-found.tsx             # 404 page ("That's what she said")
  components/
    layout/                   # Nav, Footer
    leagues/                  # StandingsTable, MatchupCard, WeekSelector, LiveScoreIndicator
    bracket/                  # BracketView
    rankings/                 # PowerRankingsTable
    transactions/             # TransactionsFeed, TransactionCard
    ui/                       # OffSeasonBanner
    providers/                # ConfigProvider (React Context)
  hooks/
    useLiveScores.ts          # Supabase Realtime + polling for matchup pages
  lib/
    supabase/client.ts        # Browser Supabase client (anon key, for Realtime)
    supabase/server.ts        # Server Supabase clients (anon + service role)
    sleeper/api.ts            # Sleeper API client (all endpoints)
    sleeper/league-data.ts    # Sleeper data processing (standings, matchups, teams)
    sleeper/types.ts          # Sleeper TypeScript interfaces
    bracket/engine.ts         # Bracket generation & seeding
    bracket/schema.ts         # Zod schemas for bracket data validation
    rankings/compute.ts       # Power rankings algorithm (win%, PF, luck, streak)
    transactions/fetch.ts     # Transaction aggregation across leagues
    players/cache.ts          # NFL player lookup (memory -> Supabase -> Sleeper)
    solver/league-solver.ts   # League structure solver (optimal configs for N players)
    member-resolver.ts        # Sleeper roster_id -> member_season_id bridge
    weekly-results.ts         # Build weekly_results rows from matchups
    config.ts                 # Season/league DB lookups + status transition validation
    auth.ts                   # Admin auth (bcrypt, sessions, requireAuth, requireSuperAdmin)
    auth-scope.ts             # Cohort-scoped access control
    recap-auth.ts             # Bearer token auth for recap API
  config/
    constants.ts              # Org name, league defaults, season status lifecycle
  styles/                     # Global CSS (animations, glass morphism, skeletons)
supabase/
  migrations/                 # 13 SQL migration files (001-013)
```

## Authentication

**Multi-user admin auth** with bcrypt password hashing and server-side sessions.

- `POST /api/admin/auth` -- login with email + password, creates session
- `DELETE /api/admin/auth` -- logout, destroys session
- `PUT /api/admin/auth` -- first-time setup (creates super_admin when 0 users exist)
- Sets `admin_session=<token>` cookie (httpOnly, secure, sameSite=strict, 24hr TTL)
- All admin routes call `await requireAuth()` from `src/lib/auth.ts`
- Roles: `super_admin` (full access) and `commissioner` (cohort-scoped)
- Rate-limited: 5 attempts/min per IP

## Supabase Client Patterns

**Server-side (all API routes):** Always use `createServiceClient()` from `src/lib/supabase/server.ts`. This uses the service role key and bypasses RLS.

**Client-side (browser):** Used in:
- `src/app/draft/[boardId]/page.tsx` — Realtime subscriptions on `draft_picks`
- `src/hooks/useLiveScores.ts` — Realtime subscriptions on `league_snapshots`

Uses `createClient()` from `src/lib/supabase/client.ts` with the anon key.

**Important:** Never use the anon client for server-side queries. Never use the service role client in browser code.

## Database Schema (24 tables)

All tables have RLS enabled. Anon SELECT policies on: `draft_picks`, `players_normalized`, `league_snapshots`. Service role key bypasses RLS.

| Table | Purpose |
|-------|---------|
| `organizations` | Single org record (Scranton Branch FFL) |
| `members` | League participants (name, email, status) |
| `seasons` | Season records with status lifecycle |
| `leagues` | League divisions per season (linked to Sleeper, optional cohort_id) |
| `member_seasons` | Members assigned to leagues per season |
| `cohorts` | Grouping layer (invite_token, registration status) |
| `season_registrations` | Signup funnel per cohort (registered/confirmed/waitlisted) |
| `admin_users` | Multi-user admin accounts (email, bcrypt hash, role) |
| `admin_sessions` | Server-side session tokens |
| `admin_cohort_assignments` | Commissioner-to-cohort access mapping |
| `draft_boards` | Draft instances (status, rounds, timer) |
| `draft_picks` | Individual picks (Realtime-enabled, anon SELECT) |
| `league_snapshots` | Cached Sleeper standings/matchups per week (Realtime-enabled) |
| `weekly_results` | Team results per week (points, record, streak, member_season_id) |
| `player_weekly_scores` | Player-level scoring per week (member_season_id) |
| `power_rankings` | Computed cross-league rankings per week (optional cohort_id) |
| `brackets` | Championship bracket data (JSONB, optional cohort_id) |
| `transactions_cache` | Cached trades/waivers per league per week |
| `players_normalized` | Per-row NFL player lookup (anon SELECT) |
| `season_archives` | Archived season snapshots (standings, awards) |
| `announcements` | Commissioner messages (optional cohort_id) |
| `newsletters` | Email recaps (optional cohort_id) |
| `subscribers` | Email list |
| `players_cache` | Legacy JSONB blob (deprecated, replaced by players_normalized) |

**Season status lifecycle:** `setup` -> `registering` -> `confirming` -> `pre_draft` -> `drafting` -> `active` -> `playoffs` -> `completed` -> `archived`

**Migrations** are in `supabase/migrations/` (001-013). Run new migrations via Supabase dashboard SQL Editor or `supabase db push`.

## API Routes

### Public (no auth)
| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/rankings` | Power rankings (5min ISR cache) |
| GET | `/api/draft?boardId=X` | Draft board data for viewers |
| GET | `/api/history` | List archived seasons |
| GET | `/api/history/[id]` | Single archive detail |
| GET | `/api/register/[token]` | Cohort info for registration page |
| POST | `/api/register/[token]` | Self-register for a cohort |

### Admin (require `admin_session` cookie)
| Method | Route | Purpose |
|--------|-------|---------|
| POST/DELETE/PUT | `/api/admin/auth` | Login / Logout / First-time setup |
| GET/PUT | `/api/admin/season` | Current season CRUD |
| GET/POST | `/api/admin/members` | Member list/create |
| GET/PUT/DELETE | `/api/admin/members/[id]` | Member detail ops |
| GET/POST | `/api/admin/setup` | Season setup wizard |
| POST | `/api/admin/setup/leagues` | League assignment |
| POST | `/api/admin/setup/sleeper` | Link Sleeper league IDs |
| POST | `/api/admin/setup/draft` | Create draft boards |
| POST | `/api/admin/setup/intake` | Member onboarding |
| GET | `/api/admin/draft` | List draft boards |
| GET/POST | `/api/admin/draft/board` | Draft board ops |
| POST | `/api/admin/draft/mock` | Create mock draft |
| GET/PUT | `/api/admin/bracket` | Bracket CRUD (Zod validated) |
| POST | `/api/admin/bracket/generate` | Auto-generate bracket (Zod validated) |
| POST | `/api/admin/bracket/scores` | Fetch bracket scores (Zod validated) |
| POST | `/api/admin/backfill` | Backfill weekly results/scores/transactions/rankings |
| POST | `/api/admin/backfill-identity` | Backfill member_season_id on historical rows |
| POST | `/api/admin/archive` | Archive season |
| GET/POST | `/api/admin/cohorts` | Cohort list/create |
| PUT | `/api/admin/cohorts/[id]` | Update cohort |
| GET | `/api/admin/cohorts/[id]/registrations` | List registrations |
| POST | `/api/admin/cohorts/[id]/confirm` | Confirm/waitlist members |
| POST | `/api/admin/cohorts/[id]/promote` | Promote waitlisted members |
| GET/POST | `/api/admin/recaps` | Recap list/create |

### Recap API (require `Authorization: Bearer RECAP_API_KEY`)
| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/recap/weekly` | Weekly matchup + stats payload for AI recap |
| GET | `/api/recap/season-summary` | End-of-season stats + awards |
| GET | `/api/recap/member-profile` | Career stats for a member |

### Cron (require `Authorization: Bearer CRON_SECRET`)
| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/cron/sync` | Daily Sleeper sync (parallel fetches, batch upserts) |

## External Integrations

**Sleeper API** (`https://api.sleeper.app/v1`): League data, rosters, matchups, transactions, drafts, NFL state, player database. Client in `src/lib/sleeper/api.ts`. No API key required.

**Supabase Realtime:** Enabled on `draft_picks` (live draft board) and `league_snapshots` (live matchup scores). Browser subscribes via anon key.

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=         # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=    # Supabase publishable key
NEXT_PUBLIC_SITE_URL=             # Site URL for SEO meta tags (optional)
SUPABASE_SERVICE_ROLE_KEY=        # Supabase secret key (server only)
CRON_SECRET=                      # Bearer token for /api/cron/sync
RECAP_API_KEY=                    # Bearer token for /api/recap/* endpoints
ANTHROPIC_API_KEY=                # For in-app recap generation
UPSTASH_REDIS_REST_URL=           # Optional Redis cache
UPSTASH_REDIS_REST_TOKEN=         # Optional Redis token
RESEND_API_KEY=                   # Optional email service
```

## Deployment

- **Vercel** with auto-deploy from git
- **Cron:** `/api/cron/sync` runs daily at 00:00 UTC (configured in `vercel.json`)
- **ISR:** Public ranking endpoint revalidates every 5 minutes
- **Security headers:** HSTS, X-Frame-Options DENY, X-Content-Type-Options nosniff (in `next.config.js`)

## Key Conventions

- Org lookup always uses `slug = 'scranton-branch-ffl'`
- All DB writes go through admin API routes with service role client
- Off-season: pages fall back to cached/archived data with an OffSeasonBanner
- Power ranking formula: Win% (40%) + Points For percentile (35%) + Luck Index (15%) + Streak (10%)
- Bracket supports 2-16 team formats with Zod-validated inputs
- Player cache: in-memory (10min) -> `players_normalized` table -> Sleeper API fallback
- Weekly results are append-only (never overwritten), include member_season_id for identity bridge
- Cohort_id is nullable on legacy tables; new data MUST set it when using cohort system
- Only the cron sync calls Sleeper API; all other code reads from Supabase
- Every route segment has loading.tsx (skeletons) and error.tsx (error boundaries)

## Common Tasks

**Add a new table:** Create a migration in `supabase/migrations/`, enable RLS, add service-role-only access (no anon policy unless browser needs Realtime).

**Add a new admin route:** Create route file in `src/app/api/admin/`, call `await requireAuth()` at the top, use `createServiceClient()` for DB access. Add Zod validation on inputs.

**Add a new public page:** Create page in `src/app/`, fetch data server-side using `createServiceClient()`, handle off-season fallback. Add `loading.tsx` and `error.tsx` in the same directory.
