# Scranton Branch Fantasy Football League

**GitHub:** https://github.com/thomassdanel-ai/scranton-branch-ffl

A fantasy football league management platform for a friend group. Cross-league power rankings, live draft boards, championship bracket, transaction feeds, and a commissioner admin dashboard.

## Tech Stack

- **Framework:** Next.js 14 (App Router), React 18, TypeScript 5
- **Database:** Supabase (PostgreSQL + Realtime)
- **Styling:** Tailwind CSS 3.4
- **External API:** Sleeper.app (league data, matchups, transactions, players)
- **Email:** Resend (configured, not actively used)
- **Cache:** Upstash Redis (configured, not actively used)
- **Deployment:** Vercel (serverless + cron)

## Directory Structure

```
src/
  app/                        # Next.js App Router
    (public pages)/           # /, /rankings, /bracket, /transactions, /history
    admin/                    # Commissioner dashboard pages
    leagues/[leagueId]/       # League standings + matchups
    draft/[boardId]/          # Live draft board (Realtime)
    api/
      admin/                  # Protected admin endpoints
      cron/sync/              # Daily Sleeper data sync
      draft/                  # Public draft board data
      rankings/               # Public power rankings
      history/                # Public season archives
  components/
    layout/                   # Nav, Footer
    leagues/                  # StandingsTable, MatchupCard, WeekSelector
    bracket/                  # BracketView
    rankings/                 # PowerRankingsTable
    transactions/             # TransactionsFeed, TransactionCard
    ui/                       # OffSeasonBanner
    providers/                # ConfigProvider (React Context)
  lib/
    supabase/client.ts        # Browser Supabase client (anon key, for Realtime)
    supabase/server.ts        # Server Supabase clients (anon + service role)
    sleeper/api.ts            # Sleeper API client (all endpoints)
    sleeper/league-data.ts    # Sleeper data processing (standings, matchups, teams)
    sleeper/types.ts          # Sleeper TypeScript interfaces
    bracket/engine.ts         # Bracket generation & seeding
    rankings/compute.ts       # Power rankings algorithm (win%, PF, luck, streak)
    transactions/fetch.ts     # Transaction aggregation across leagues
    players/cache.ts          # NFL player lookup (memory -> Supabase -> Sleeper)
    weekly-results.ts         # Build weekly_results rows from matchups
    config.ts                 # Season/league DB lookups (getActiveSeasonId, etc.)
    auth.ts                   # Admin auth check (isAuthed)
  config/
    constants.ts              # Org name, league defaults, commissioner ID
  styles/                     # Global CSS
supabase/
  migrations/                 # 7 SQL migration files (001-007)
```

## Authentication

**No Supabase Auth.** Admin access uses a single shared password.

- `POST /api/admin/auth` -- validates password (timing-safe, rate-limited: 5/min per IP)
- Sets `admin_auth=true` cookie (httpOnly, secure, sameSite=strict, 24hr TTL)
- All admin routes check `isAuthed()` from `src/lib/auth.ts`
- Password stored in `ADMIN_PASSWORD` env var

## Supabase Client Patterns

**Server-side (all API routes):** Always use `createServiceClient()` from `src/lib/supabase/server.ts`. This uses the service role key and bypasses RLS.

**Client-side (browser):** Only used in `src/app/draft/[boardId]/page.tsx` for Realtime subscriptions on `draft_picks`. Uses `createClient()` from `src/lib/supabase/client.ts` with the anon key.

**Important:** Never use the anon client for server-side queries. Never use the service role client in browser code.

## Database Schema (18 tables)

All tables have RLS enabled (migration 007). Only `draft_picks` has an anon SELECT policy (for Realtime). Service role key bypasses RLS.

| Table | Purpose |
|-------|---------|
| `organizations` | Single org record (Scranton Branch FFL) |
| `members` | League participants (name, email, status) |
| `seasons` | Season records with status lifecycle |
| `leagues` | League divisions per season (linked to Sleeper) |
| `member_seasons` | Members assigned to leagues per season |
| `draft_boards` | Draft instances (status, rounds, timer) |
| `draft_picks` | Individual picks (Realtime-enabled, anon SELECT) |
| `league_snapshots` | Cached Sleeper standings/matchups per week |
| `weekly_results` | Team results per week (points, record, streak) |
| `player_weekly_scores` | Player-level scoring per week |
| `power_rankings` | Computed cross-league rankings per week |
| `brackets` | Championship bracket data (JSONB) |
| `transactions_cache` | Cached trades/waivers per league per week |
| `players_cache` | Full NFL player lookup (refreshed daily) |
| `season_archives` | Archived season snapshots (standings, awards) |
| `announcements` | Commissioner messages |
| `newsletters` | Email recaps (unused) |
| `subscribers` | Email list (unused) |

**Season status lifecycle:** `setup` -> `pre_draft` -> `drafting` -> `active` -> `playoffs` -> `completed`

**Migrations** are in `supabase/migrations/` (001-007). Run new migrations via Supabase dashboard SQL Editor or `supabase db push`.

## API Routes

### Public (no auth)
| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/rankings` | Power rankings (5min ISR cache) |
| GET | `/api/draft?boardId=X` | Draft board data for viewers |
| GET | `/api/history` | List archived seasons |
| GET | `/api/history/[id]` | Single archive detail |

### Admin (require `admin_auth` cookie)
| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/admin/auth` | Login |
| GET/PUT | `/api/admin/season` | Current season CRUD |
| GET/POST | `/api/admin/members` | Member list/create |
| GET/PUT/DELETE | `/api/admin/members/[id]` | Member detail ops |
| GET/POST | `/api/admin/setup` | Season setup wizard |
| POST | `/api/admin/setup/leagues` | League assignment |
| POST | `/api/admin/setup/sleeper` | Link Sleeper league IDs |
| POST | `/api/admin/setup/draft` | Create draft boards |
| POST | `/api/admin/setup/intake` | Member onboarding |
| GET | `/api/admin/draft` | List draft boards |
| GET/POST | `/api/admin/draft/board` | Draft board ops (start, pick, pause, resume, complete) |
| POST | `/api/admin/draft/mock` | Create mock draft |
| GET/PUT | `/api/admin/bracket` | Bracket CRUD |
| POST | `/api/admin/bracket/generate` | Auto-generate bracket |
| POST | `/api/admin/bracket/scores` | Fetch bracket scores |
| POST | `/api/admin/backfill` | Backfill weekly results/scores/transactions/rankings |
| POST | `/api/admin/archive` | Archive season |

### Cron (require `Authorization: Bearer CRON_SECRET`)
| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/cron/sync` | Daily Sleeper sync (matchups, snapshots, rankings, transactions) |

## External Integrations

**Sleeper API** (`https://api.sleeper.app/v1`): League data, rosters, matchups, transactions, drafts, NFL state, player database. Client in `src/lib/sleeper/api.ts`. No API key required.

**Supabase Realtime:** Enabled on `draft_picks` table only. Used by the public draft board page for live updates via PostgreSQL changes channel.

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=         # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=    # Supabase publishable key
SUPABASE_SERVICE_ROLE_KEY=        # Supabase secret key (server only)
ADMIN_PASSWORD=                   # Commissioner login password
CRON_SECRET=                      # Bearer token for /api/cron/sync
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
- Bracket supports 2, 4, 6, or 8 team formats
- Player cache is 3-tier: in-memory (10min) -> Supabase (24hr) -> Sleeper API
- Weekly results are append-only (never overwritten)

## Common Tasks

**Add a new table:** Create a migration in `supabase/migrations/`, enable RLS, add service-role-only access (no anon policy unless browser needs it).

**Add a new admin route:** Create route file in `src/app/api/admin/`, check `isAuthed()` at the top, use `createServiceClient()` for DB access.

**Add a new public page:** Create page in `src/app/`, fetch data server-side using `createServiceClient()`, handle off-season fallback.
