# PROJECT_SPEC.md — Scranton Branch Fantasy Football League

> **This document is the single source of truth for building the Scranton Branch FFL website.**
> Claude Code should read this file first before making any changes to the codebase.

---

## 1. Project Overview

The **Scranton Branch Fantasy Football League** is a work league spanning multiple departments, all rolling up under the same SVP. It currently runs as two separate 10-team leagues on Sleeper, with a cross-league championship bracket tracked manually by the commissioner.

This project builds a **custom website** that consolidates scores, standings, transactions, and activity from all Sleeper leagues into one unified, high-production-value hub — ad-free, modern, and designed to make a free work league feel like an ESPN broadcast.

### Commissioner
- **Sleeper Username:** T_Danel
- **Sleeper User ID:** 739591965980643328

### Repository
- **GitHub:** `thomassdanel-ai/scranton-branch-ffl`
- **Branch strategy:** `main` (production, auto-deploys to Vercel)

---

## 2. League Configuration

The league structure is **flexible by design**. The number of leagues and teams may change season to season. The site must adapt to 2, 3, or 4+ leagues without code changes — only configuration updates.

### Current Leagues (2025 Season)

| League Name | League ID | Teams | Format |
|---|---|---|---|
| Scranton Branch - Sales | `1260755589445718016` | 10 | PPR, 6pt Pass TD |
| Scranton Branch - Accounting | `1259609557903081472` | 10 | PPR, 6pt Pass TD |

### Configuration File

All league IDs, season info, and bracket settings should live in a single config file:

```typescript
// src/config/leagues.ts
export const LEAGUE_CONFIG = {
  name: "Scranton Branch Fantasy Football League",
  shortName: "Scranton Branch FFL",
  commissionerUserId: "739591965980643328",
  currentSeason: "2025",
  leagues: [
    {
      id: "1260755589445718016",
      name: "Sales",
      shortName: "Sales",
    },
    {
      id: "1259609557903081472",
      name: "Accounting",
      shortName: "Acct",
    },
  ],
  championship: {
    qualifiersPerLeague: 3,
    format: "bracket",
  },
};
```

When leagues are added or removed between seasons, only this config changes.

---

## 3. Architecture

### Tech Stack

| Layer | Technology | Tier |
|---|---|---|
| Framework | **Next.js 14+ (App Router)** | — |
| Language | **TypeScript** | — |
| Styling | **Tailwind CSS** | — |
| Database | **Supabase** (PostgreSQL) | Free (500MB) |
| Hosting | **Vercel** | Free |
| Email | **Resend** | Free (100/day) |
| Caching | **Upstash Redis** | Free |
| Analytics | **Vercel Analytics** | Free |
| Domain | Custom domain (~$12/yr) | Paid |

### Estimated Annual Cost: ~$12/year (domain only)

### Why Server-Side?

- **Background sync via Vercel Cron Jobs** — fetch Sleeper data on a schedule, serve cached results to all 20 members instead of redundant client-side API calls
- **Persistent historical storage** — Sleeper league IDs change each season; our database preserves all historical data permanently
- **Commissioner admin panel** — announcements and newsletter composition require server-side storage
- **ISR (Incremental Static Regeneration)** — pages are statically generated and revalidated every few minutes for instant loads
- **Supabase Realtime** — live-updating scores on game day without manual refresh

### Data Flow

```
Sleeper API --(Cron: every 5 min during games, every 30 min otherwise)--> Supabase DB
                                                                              |
                                                                              v
                                                                     Upstash Redis Cache
                                                                              |
                                                                              v
                                                                   Next.js ISR Pages
                                                                              |
                                                                              v
                                                                     User's Browser
```

---

## 4. Sleeper API Reference

Base URL: `https://api.sleeper.app/v1`

**No authentication required.** All endpoints are read-only. Stay under 1000 calls/minute to avoid IP blocking.

### Endpoints Used

| Endpoint | Purpose | Cache Duration |
|---|---|---|
| `GET /state/nfl` | Current NFL week, season status | 1 hour |
| `GET /league/{id}` | League settings, name, format | 1 hour |
| `GET /league/{id}/users` | All users in a league (display names, avatars, team names) | 1 hour |
| `GET /league/{id}/rosters` | Rosters with win/loss records, points for/against | 5 min (game day), 30 min (off) |
| `GET /league/{id}/matchups/{week}` | Matchup pairings and scores for a given week | 5 min (game day), 30 min (off) |
| `GET /league/{id}/transactions/{week}` | Trades, waivers, free agent adds/drops | 15 min |
| `GET /league/{id}/traded_picks` | All traded draft picks | 1 hour |
| `GET /league/{id}/drafts` | Draft metadata | 1 hour |
| `GET /draft/{id}/picks` | All picks in a draft | 1 hour |
| `GET /user/{id}` | User profile (avatar, display name) | 1 day |
| `GET /players/nfl` | All NFL players (~5MB, cache locally) | 1 day |
| `GET /players/nfl/trending/{add|drop}` | Trending players | 6 hours |

### Avatar URLs
- Full: `https://sleepercdn.com/avatars/{avatar_id}`
- Thumbnail: `https://sleepercdn.com/avatars/thumbs/{avatar_id}`

### Key Data Relationships
- **Users** have a `user_id` and optionally a `metadata.team_name`
- **Rosters** have a `roster_id`, `owner_id` (maps to `user_id`), and `settings` with wins/losses/points
- **Matchups** have a `matchup_id` (teams with the same matchup_id play each other), `roster_id`, `points`, `starters`, and `players`
- **Transactions** include `type` (trade, waiver, free_agent), `adds`, `drops`, `creator`, and `status`

---

## 5. Features

### 5.1 Dashboard (Home Page)

The main landing page. Should feel like a sports broadcast — not a spreadsheet.

- **Hero section** with league name, current season, current NFL week status
- **Live/Recent scores ticker** — latest matchup results across all leagues
- **Unified Power Rankings** — cross-league composite ranking (see 5.2)
- **Activity feed** — recent trades, waiver pickups, and commissioner announcements, merged chronologically across all leagues
- **Quick links** to each league's standings and matchups
- **Season status indicator** — preseason, regular season (with week number), playoffs, offseason

### 5.2 Cross-League Power Rankings

The signature feature. A single ranked list combining all teams from all leagues.

**Composite Score Formula (configurable weights):**
```
Power Score = (Win% x 40) + (Points For Rank x 35) + (Points Against Luck x 15) + (Streak x 10)
```

- **Win%** — straightforward win percentage
- **Points For Rank** — ranked by total points scored across all teams in all leagues (percentile)
- **Points Against Luck** — measures schedule luck (how actual record compares to expected record based on weekly scores vs all teams)
- **Streak** — current win/loss streak bonus/penalty

Display as a styled leaderboard with:
- Rank number with movement arrows (up/down from last week)
- Team name & avatar
- League badge (Sales, Accounting, etc.)
- Record, PF, PA
- Power score
- Mini trend chart (last 5 weeks)

### 5.3 Championship Bracket

Flexible bracket engine for the cross-league playoffs.

**How it works:**
- Commissioner configures `qualifiersPerLeague` in the config (e.g., top 3 from each league)
- System auto-seeds based on cross-league power rankings
- Bracket structure adapts to total number of qualifiers:
  - **4 teams:** Single elimination, 2 rounds
  - **6 teams:** Top 2 seeds get byes, then semis + finals
  - **8 teams:** Clean 3-round single elimination
  - **10+ teams:** Play-in round, then standard bracket
- Interactive SVG/Canvas bracket visualization
- Commissioner can manually override matchup results from the admin panel
- Bracket state stored in Supabase (not derived from Sleeper, since this is a custom cross-league playoff)

### 5.4 League Explorer

Drill into each individual league's data.

- **Standings table** — W/L, PF, PA, streak, playoff clinch indicators
- **Weekly matchups** — week-by-week results with scores, expandable to see starter lineups
- **Roster viewer** — each team's full roster with player positions and stats
- **Head-to-head records** — season series between any two teams within a league

### 5.5 Transactions Feed

A unified stream of all league activity.

- **Trades** — show both sides with player names and picks involved
- **Waiver claims** — successful and failed (with priority/FAAB amounts if applicable)
- **Free agent adds/drops** — who picked up who
- Filterable by league, transaction type, team, and date range
- Each transaction shows timestamp, league badge, and team involved

### 5.6 Historical Archives

Past seasons preserved permanently in Supabase.

- **Season selector** dropdown in the nav
- **Final standings** for each league each season
- **Championship bracket results** with winner highlighted
- **Season awards** (MVP, highest single-week score, most transactions, etc.) — derived from data
- **All-time records** — career wins, career points, head-to-head all-time records
- At end of each season, commissioner triggers an "Archive Season" action from admin panel that snapshots all data

### 5.7 Commissioner Admin Panel

Protected route (authenticated via a simple password or Supabase auth).

- **Announcements** — WYSIWYG editor to post news/updates to the dashboard activity feed
- **Newsletter Composer** — rich text editor with pre-built HTML email templates:
  - Branded header with Scranton Branch FFL graphics
  - Auto-populated score summary tables for the week
  - Power rankings snapshot
  - Sections for: Matchup Spotlights, Trade of the Week, Waiver Wire Hero, Trash Talk Corner
  - Preview mode (see exactly what the email will look like)
  - Send via Resend to all league members
  - Sent newsletters are archived and viewable on the site as a "Recaps" page
- **Bracket Manager** — input championship matchup results
- **Season Management** — archive a season, configure new season league IDs
- **Email List Management** — add/remove member email addresses for newsletter distribution

### 5.8 Recaps Archive (Newsletter History)

Public page listing all past newsletter/recap emails.

- Chronological list with week number, date, and preview snippet
- Click to view the full HTML recap in a styled reading view
- Feels like a mini sports blog

---

## 6. Database Schema (Supabase)

```sql
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
```

---

## 7. Project Structure

```
scranton-branch-ffl/
├── src/
│   ├── app/                          # Next.js App Router pages
│   │   ├── layout.tsx                # Root layout with nav
│   │   ├── page.tsx                  # Dashboard (home)
│   │   ├── rankings/
│   │   │   └── page.tsx              # Cross-league power rankings
│   │   ├── bracket/
│   │   │   └── page.tsx              # Championship bracket
│   │   ├── leagues/
│   │   │   └── [leagueId]/
│   │   │       ├── page.tsx          # League standings
│   │   │       ├── matchups/
│   │   │       │   └── page.tsx      # Weekly matchups
│   │   │       └── roster/
│   │   │           └── [rosterId]/
│   │   │               └── page.tsx  # Team roster detail
│   │   ├── transactions/
│   │   │   └── page.tsx              # Unified transactions feed
│   │   ├── recaps/
│   │   │   ├── page.tsx              # Newsletter archive list
│   │   │   └── [id]/
│   │   │       └── page.tsx          # Individual recap view
│   │   ├── history/
│   │   │   └── [season]/
│   │   │       └── page.tsx          # Historical season archive
│   │   ├── admin/
│   │   │   ├── page.tsx              # Admin dashboard
│   │   │   ├── announcements/
│   │   │   │   └── page.tsx          # Manage announcements
│   │   │   ├── newsletter/
│   │   │   │   └── page.tsx          # Newsletter composer
│   │   │   ├── bracket/
│   │   │   │   └── page.tsx          # Bracket manager
│   │   │   └── season/
│   │   │       └── page.tsx          # Season management
│   │   └── api/
│   │       ├── cron/
│   │       │   └── sync/
│   │       │       └── route.ts      # Cron job: sync Sleeper data
│   │       ├── send-newsletter/
│   │       │   └── route.ts          # Send newsletter via Resend
│   │       └── admin/
│   │           └── [...]/route.ts    # Admin API routes
│   ├── components/
│   │   ├── ui/                       # Base UI components
│   │   ├── dashboard/                # Dashboard-specific components
│   │   ├── rankings/                 # Power rankings table/cards
│   │   ├── bracket/                  # Bracket visualization
│   │   ├── matchups/                 # Matchup cards
│   │   ├── transactions/             # Transaction feed items
│   │   ├── newsletter/               # Newsletter composer components
│   │   └── layout/                   # Nav, footer, sidebar
│   ├── lib/
│   │   ├── sleeper/
│   │   │   ├── api.ts                # Sleeper API client functions
│   │   │   └── types.ts              # TypeScript types for Sleeper data
│   │   ├── supabase/
│   │   │   ├── client.ts             # Supabase client
│   │   │   ├── server.ts             # Supabase server client
│   │   │   └── types.ts              # Database types
│   │   ├── rankings/
│   │   │   └── compute.ts            # Power rankings algorithm
│   │   ├── bracket/
│   │   │   └── engine.ts             # Bracket generation logic
│   │   ├── email/
│   │   │   ├── resend.ts             # Resend client
│   │   │   └── templates/            # HTML email templates
│   │   └── utils.ts                  # Shared utilities
│   ├── config/
│   │   └── leagues.ts                # League configuration
│   └── styles/
│       └── globals.css               # Global styles + Tailwind
├── public/
│   ├── images/                       # Static images, logos
│   └── fonts/                        # Custom fonts if any
├── supabase/
│   └── migrations/                   # Database migrations
├── .env.local.example                # Environment variable template
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
├── package.json
├── vercel.json                       # Cron job configuration
├── PROJECT_SPEC.md                   # This file
└── README.md
```

---

## 8. Design System

### Philosophy
Clean, modern, dark-mode-forward sports aesthetic. High production value. Subtle Office/Scranton nods — never campy.

### Color Palette
```css
/* Primary — Dunder Mifflin inspired, modernized */
--color-primary: #1a73e8;        /* Bright blue (action, links, CTAs) */
--color-primary-dark: #0d47a1;

/* Background — Dark mode first */
--color-bg-primary: #0a0e17;     /* Deep navy-black */
--color-bg-secondary: #111827;   /* Card backgrounds */
--color-bg-tertiary: #1f2937;    /* Elevated surfaces */

/* Text */
--color-text-primary: #f9fafb;
--color-text-secondary: #9ca3af;
--color-text-muted: #6b7280;

/* Accents */
--color-accent-green: #10b981;   /* Wins, positive trends */
--color-accent-red: #ef4444;     /* Losses, negative trends */
--color-accent-gold: #f59e0b;    /* Champions, highlights */
--color-accent-purple: #8b5cf6;  /* Special features */

/* League badges (one per league, expandable) */
--color-league-sales: #3b82f6;
--color-league-accounting: #10b981;
/* Add more as leagues are added */
```

### Typography
- **Headings:** Inter or similar geometric sans-serif, bold
- **Body:** Inter, regular weight
- **Monospace accents:** JetBrains Mono for scores and stats
- **Numbers in standings/scores** should be tabular-nums for alignment

### Subtle Scranton Touches
- Paper texture overlay at very low opacity on card backgrounds
- League trophy icon is a Dundie Award silhouette
- 404 page: "That's what she said" moment or "I declare bankruptcy" joke
- Footer: "Scranton Branch — A Dunder Mifflin Production" in small text
- Season champion page has confetti animation
- Loading states use a paper airplane animation

### Component Style Guide
- **Cards:** Rounded corners (12px), subtle border, slight glass-morphism effect
- **Tables:** Alternating row colors, sticky headers, hover highlights
- **Animations:** Subtle and purposeful — page transitions, number counting up, rank movement arrows
- **Responsive:** Mobile-first. The 20 league members will check this on their phones constantly on Sundays

---

## 9. Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Upstash Redis
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Resend (email)
RESEND_API_KEY=
RESEND_FROM_EMAIL=commissioner@scrantonbranchffl.com

# Admin
ADMIN_PASSWORD=

# Vercel (auto-set on Vercel)
CRON_SECRET=
```

Create a `.env.local.example` with all keys listed (values blank) so the commissioner can fill them in during setup.

---

## 10. Cron Job Schedule

Configured in `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/sync",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

The sync endpoint should be smart about frequency:
- **Game day (Sunday/Monday/Thursday):** Sync every 5 minutes during game hours (12pm-12am ET)
- **Other days during the season:** Sync every 30 minutes
- **Offseason:** Sync once daily (just to catch any roster moves or league changes)

The cron runs every 5 min via Vercel, but the sync logic checks the NFL state and skips if it's not time yet (to stay within free tier limits).

---

## 11. Deployment & Setup

### Initial Setup
1. Clone the repo: `git clone https://github.com/thomassdanel-ai/scranton-branch-ffl.git`
2. Install dependencies: `npm install`
3. Create a Supabase project (free tier) at supabase.com
4. Run database migrations: `npx supabase db push`
5. Create an Upstash Redis instance (free tier) at upstash.com
6. Create a Resend account (free tier) at resend.com
7. Copy `.env.local.example` to `.env.local` and fill in all values
8. Run locally: `npm run dev`

### Deploy to Vercel
1. Push to `main` branch on GitHub
2. Connect the repo to Vercel (one-time setup)
3. Add all environment variables in Vercel dashboard
4. Vercel auto-deploys on every push to `main`
5. Connect custom domain in Vercel settings

### New Season Setup
1. Create new leagues on Sleeper
2. Update `src/config/leagues.ts` with new league IDs and season
3. Use admin panel "Archive Season" to snapshot the completed season
4. Push to `main` — site auto-updates

---

## 12. Build Phases

### Phase 1: Foundation
- [ ] Next.js project scaffold with TypeScript + Tailwind
- [ ] Supabase setup with migrations
- [ ] Sleeper API client library (`src/lib/sleeper/`)
- [ ] League config system
- [ ] Basic layout (nav, footer, responsive shell)
- [ ] Cron job for data syncing

### Phase 2: Core Pages
- [ ] Dashboard home page
- [ ] Cross-league power rankings
- [ ] League explorer (standings, matchups)
- [ ] Transactions feed

### Phase 3: Championship & History
- [ ] Championship bracket engine + visualization
- [ ] Bracket manager in admin panel
- [ ] Historical season archives
- [ ] Season archival flow

### Phase 4: Commissioner Tools
- [ ] Admin panel with password auth
- [ ] Announcements CRUD
- [ ] Newsletter composer with templates
- [ ] Resend email integration
- [ ] Recaps archive page

### Phase 5: Polish
- [ ] Supabase Realtime for live score updates
- [ ] Upstash Redis caching layer
- [ ] Vercel Analytics integration
- [ ] Loading states and animations
- [ ] Error boundaries and offline handling
- [ ] SEO and Open Graph meta tags
- [ ] Mobile optimization pass
- [ ] Scranton easter eggs

---

## 13. Key Technical Decisions

1. **Player data caching:** The `/players/nfl` endpoint returns ~5MB. Fetch once daily and store in Supabase. Serve from Redis cache for lookups.

2. **Cross-league user identity:** Users may have different roster_ids across leagues but the same user_id. Always map through user_id for cross-league features.

3. **Bracket state is manual:** The championship bracket is NOT derived from Sleeper playoff data. It is a custom cross-league construct managed by the commissioner through the admin panel.

4. **Newsletter HTML:** Pre-build responsive HTML email templates. Emails must render in Gmail, Outlook, and Apple Mail. Use tables for layout (email HTML is stuck in 2005). Test with Resend's preview feature.

5. **Historical data:** When a season ends, snapshot all league_snapshots, power_rankings, and bracket data into season_archives. This is a one-time operation triggered by the commissioner.

6. **Flexible league count:** Every feature that loops over leagues should use the config array, never hardcode league count or IDs. The bracket engine takes N qualifiers and generates the appropriate structure automatically.

---

*Last updated: March 23, 2026*
*Commissioner: T_Danel*
