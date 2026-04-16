# Claude Code Prompt — Scranton Branch FFL V2 Execution

> Copy everything below this line into a fresh Claude Code conversation.

---

## Context (carry forward from prior sessions)

<context>
You are working on the **Scranton Branch Fantasy Football League** platform — a Next.js 14 App Router project with TypeScript 5, React 18, Tailwind CSS 3.4, Supabase (PostgreSQL + Realtime), and deployed on Vercel.

### What's already shipped (commit 90a319b):
- Phases 0-5 and 8-9 of EXECUTION_PLAN.md are complete
- Multi-user admin auth (bcrypt, sessions, roles: super_admin / commissioner)
- Cohort system (invite tokens, registration, waitlist, scoped access)
- Identity bridge (member_season_id on weekly_results + player_weekly_scores)
- Normalized player cache (players_normalized table replacing JSONB blob)
- Cross-league power rankings reading from DB (not Sleeper API)
- Cron sync with parallel fetches, batch upserts
- Zod validation, error boundaries, loading skeletons, live scores via Realtime
- Draft board with Supabase Realtime (manual pick entry — to be replaced)
- Season setup wizard (5 steps — to be redesigned)

### 8 Invariants (NEVER violate):
1. Only the cron sync calls Sleeper API. Every other file reads from Supabase.
2. Every team result has a `member_season_id`. New rows must populate it.
3. Admin routes check scope: `requireAuth()` + cohort scope on every admin endpoint.
4. One active season per org (enforced by partial unique index).
5. `cohort_id` is nullable on legacy tables. New data through cohort system MUST set it.
6. Solver is a recommendation — commissioner has final say on league structure.
7. Invite tokens are secrets. Never expose in logged URLs.
8. Recaps are per-cohort. Recap API always requires a cohort_id.

### Sleeper API is 100% read-only:
- Base URL: `https://api.sleeper.app/v1`
- No auth required, no POST/PUT/DELETE endpoints exist
- You CANNOT push draft picks to Sleeper. Sleeper slow draft is the source of truth; we pull picks FROM Sleeper INTO our DB.

### Key files to read first:
- `EXECUTION_PLAN.md` — master plan (Phases 0-9, all completed)
- `CLAUDE.md` — project conventions, 24 tables, auth system, directory structure
- `src/config/constants.ts` — org constants, season status lifecycle, transitions
- `src/lib/config.ts` — season/league DB lookups, status validation
- `src/lib/auth.ts` — multi-user auth with bcrypt + sessions
- `src/lib/auth-scope.ts` — cohort-scoped access control
</context>

## Objective

Build the **V2 feature set**: Commissioner Command Center, Member Identity Layer, Sleeper Draft Sync, Situation Room, and Cohort Invite Workflow overhaul. These are 5 new systems that transform the admin experience and add member-facing scoped views.

## Starting State

The codebase is at commit `90a319b`. All V1 phases are complete. The current admin dashboard (`src/app/admin/page.tsx`) is a simple grid of 6 link cards. The season setup wizard (`src/app/admin/season-setup/page.tsx`) forces manual member addition with no cohort awareness. The draft board (`src/app/admin/draft/page.tsx`) uses manual pick entry.

## Target State

When you are done, the platform has:

1. **Commissioner Command Center** replacing the admin dashboard
2. **Member identity layer** so members auto-scope to their league via email lookup
3. **Sleeper draft sync** replacing manual pick entry
4. **Situation room** for commissioner to monitor all active drafts
5. **Cohort invite workflow** with generated links, copy buttons, email generation, and per-link stats

---

## System 1: Commissioner Command Center

**Replace** `src/app/admin/page.tsx` with a dashboard containing these panels:

### 1A — Status Hero Banner
- Full-width top panel showing current season phase as a horizontal pipeline
- Phases: Setup → Registration → Confirmation → Pre-Draft → Drafting → Active → Playoffs → Complete
- Active phase glows, completed phases show checkmarks, future phases are dimmed
- Shows season year, org name, and a "days until next milestone" countdown

### 1B — Cohort Cards
- One card per cohort showing: name, color badge, registration count vs capacity, progress bar
- Each card has: "Copy Invite Link" button, "Generate Email" button, status chip (open/closed/confirmed)
- Registration count updates reflect real DB data from `season_registrations`

### 1C — Registration Activity Feed
- Chronological feed of recent registrations across all cohorts
- Each entry: member name, cohort name (color-coded), timestamp, status badge
- Data source: `season_registrations` joined with `members` and `cohorts`

### 1D — League Health Grid
- Grid of league cards (one per league in active season)
- Each card shows: member count, draft status (not started / in progress / complete), Sleeper link status, current week leader + record
- Data source: `leagues` joined with `member_seasons`, `draft_boards`, `weekly_results`

### 1E — Setup Wizard Progress
- 6-step stepper: Create Season → Cohorts & Invites → Registration → League Assignment → Draft Setup → Sleeper Linking
- Lock icons on steps that aren't reachable yet (based on season status)
- Click any unlocked step to jump to that wizard section

### 1F — Quick Actions Panel
- Action buttons: "Advance Season Phase", "Send Cohort Email", "Generate Recap", "View Bracket", "Open Situation Room"
- Each button has a left-border color accent and icon
- Buttons are contextually enabled/disabled based on season status

### Design direction:
- Dark glassmorphism theme (rgba backgrounds with backdrop-blur)
- Font: Inter for body, JetBrains Mono for stats/numbers
- League color tokens: blue (#3b82f6), green (#10b981), amber (#f59e0b), red (#ef4444)
- Framer Motion for panel entrance animations and hover effects
- Lucide icons throughout
- Reference design (Magic Patterns): https://www.magicpatterns.com/c/1zjmxfszvg32bhaots1kvk

### API endpoints needed:
- `GET /api/admin/dashboard` — aggregated dashboard data (season status, cohort stats, recent registrations, league health)
- Reuse existing endpoints where possible: `/api/admin/cohorts`, `/api/admin/season`

---

## System 2: Member Identity Layer

**Goal:** When a member visits the site, they enter their email once, get a cookie, and all pages auto-scope to their league.

### 2A — Email Lookup Flow
- New page: `src/app/identify/page.tsx`
- Simple form: "Enter your email to see your league"
- On submit: `POST /api/identify` — looks up `members.email`, finds `member_seasons` for active season, returns `{ memberId, memberSeasonId, leagueId, leagueName, cohortId }`
- Sets `httpOnly` cookie: `member_id=<uuid>` (secure, sameSite=strict, 30-day TTL)
- Redirects to homepage with scoped content

### 2B — Middleware Scoping
- New utility: `src/lib/member-scope.ts`
  - `getMemberFromCookie(req)` — reads `member_id` cookie, queries `member_seasons` for active season, returns `{ memberId, memberSeasonId, leagueId, cohortId }` or null
  - Used by public pages (draft board, standings, etc.) to auto-scope content
- If no cookie set, show a prompt banner: "Identify yourself to see your league" with link to `/identify`

### 2C — Auto-Scoped Pages
- **Draft Board** (`/draft/[boardId]`): If member cookie exists, auto-navigate to their league's draft board
- **Standings** (`/leagues/[leagueId]`): Default to member's league
- **Rankings**: Highlight member's team in the power rankings table
- **Navigation**: Show "Your League: [name]" in the nav when identified

### 2D — Clear Identity
- Small "Not you?" link in nav that clears the `member_id` cookie and redirects to `/identify`
- Worst case: member clears browser cookies to reset

### Migration needed:
None — uses existing `members` and `member_seasons` tables.

---

## System 3: Sleeper Draft Sync

**Goal:** Replace manual pick entry. Sleeper slow draft is source of truth. Cron pulls picks into our DB.

### 3A — Database Changes

**New migration (014):**
```sql
-- Link draft boards to Sleeper drafts
ALTER TABLE draft_boards ADD COLUMN sleeper_draft_id TEXT;
CREATE INDEX idx_draft_boards_sleeper ON draft_boards(sleeper_draft_id);

-- Add sleeper_pick_id to draft_picks for dedup
ALTER TABLE draft_picks ADD COLUMN sleeper_pick_id TEXT;
CREATE UNIQUE INDEX idx_draft_picks_sleeper ON draft_picks(sleeper_pick_id) WHERE sleeper_pick_id IS NOT NULL;
```

### 3B — Draft Sync Cron

**New file:** `src/app/api/cron/draft-sync/route.ts`

Logic:
1. Query `draft_boards` where `status IN ('active', 'paused')` and `sleeper_draft_id IS NOT NULL`
2. For each board, call `GET /v1/draft/<sleeper_draft_id>/picks`
3. Map each Sleeper pick to a `draft_picks` row:
   - `sleeper_pick_id` = `<draft_id>-<pick_number>` (dedup key)
   - `player_id` from Sleeper pick data
   - `roster_id` from Sleeper pick
   - Resolve `member_season_id` via `member-resolver.ts`
   - Look up player name from `players_normalized`
4. Upsert into `draft_picks` with `onConflict: 'sleeper_pick_id'`
5. If all picks are in (round × teams), mark `draft_boards.status = 'completed'`

**Cron schedule:** Every 2 minutes during draft season (configurable via `vercel.json`)

**Stop condition:** When `draft_boards.status = 'completed'` for all boards, the cron becomes a no-op.

### 3C — Draft Board UI Update

**Update:** `src/app/admin/draft/page.tsx` and `src/app/draft/[boardId]/page.tsx`
- Remove manual pick entry form entirely
- Keep the snake-order grid visualization (it's good)
- Add Supabase Realtime subscription on `draft_picks` for live updates
- Add "Last synced: X seconds ago" indicator
- Add "Sync Now" button for commissioner (triggers `/api/admin/draft/sync` one-shot)

### 3D — Sleeper Draft Linking

**Update season setup wizard** — add a "Link Sleeper Drafts" step:
- For each league, input field for Sleeper Draft ID
- Validate by calling `GET /v1/draft/<id>` and checking it returns data
- Save to `draft_boards.sleeper_draft_id`
- Auto-create draft_board records if they don't exist

---

## System 4: Situation Room

**Goal:** Commissioner hub aggregating all active draft states across all leagues.

### 4A — New Page: `src/app/admin/situation-room/page.tsx`

Layout:
- Top bar: Season name, "X of Y drafts active", global progress percentage
- Grid of mini draft boards (one per league):
  - League name + color badge
  - Circular progress indicator (picks made / total picks)
  - Current pick: "Round X, Pick Y — [Team Name] is on the clock"
  - Last 3 picks as a mini feed
  - Status badge: Not Started / Active / Paused / Complete
  - Click to expand into full draft board view
- Bottom panel: Unified activity feed across all leagues (most recent picks, sorted by timestamp)

### 4B — API Endpoint

`GET /api/admin/situation-room` — returns:
```typescript
{
  drafts: [{
    boardId: string;
    leagueId: string;
    leagueName: string;
    leagueColor: string;
    status: 'pending' | 'active' | 'paused' | 'completed';
    totalPicks: number;
    picksMade: number;
    currentPick: { round: number; pick: number; teamName: string } | null;
    recentPicks: { playerName: string; teamName: string; round: number; pick: number; timestamp: string }[];
    lastSyncedAt: string;
  }];
  recentActivity: { /* same as recentPicks but across all leagues */ }[];
}
```

### 4C — Realtime Updates
- Subscribe to `draft_picks` changes across all boards
- When a new pick arrives, update the relevant mini board and the unified feed
- Use Supabase Realtime with a filter on `draft_board_id IN (active board IDs)`

---

## System 5: Cohort Invite Workflow Overhaul

**Goal:** Commissioner generates invite links in-app with labels, copy buttons, per-link stats, and email generation.

### 5A — Cohort Management Panel (in Command Center)
- Already described in System 1B above
- Add: click a cohort card to expand into a detail view showing:
  - Full registration list with status badges (registered/confirmed/waitlisted/declined)
  - Capacity settings (max members, auto-waitlist threshold)
  - Invite link with copy-to-clipboard button
  - "Generate Invite Email" button

### 5B — Email Generation
- **New component:** `src/components/admin/InviteEmailGenerator.tsx`
- Generates a pre-formatted email body with:
  - Season name and year
  - Cohort name
  - Registration deadline (if set)
  - Invite link (full URL)
  - Brief instructions for the recipient
- "Copy Email" button copies the formatted text to clipboard
- Format: plain text suitable for pasting into any email client
- Do NOT send emails programmatically — just generate the copy

### 5C — Registration Stats
- Per-cohort: total registered, confirmed, waitlisted, declined, capacity remaining
- Visual: progress bar showing registered/capacity ratio
- Timestamp of most recent registration
- Data source: aggregate query on `season_registrations` grouped by status

### 5D — Season Setup Wizard Redesign
- **Replace Step 1** (manual member addition) with "Cohorts & Registration":
  - Create cohorts (name, color, optional capacity)
  - Generate invite links
  - View registration progress
  - Close registration when ready
- **New Step 2:** "Review Registrations" — see who signed up per cohort, confirm/waitlist/decline
- **Steps 3-5:** Keep existing (league assignment with solver, draft order, Sleeper linking)
- **New Step 6:** "Link Sleeper Drafts" — connect each league to its Sleeper draft ID

---

## Allowed Actions

- Create new files and directories under `src/`
- Create new Supabase migrations in `supabase/migrations/`
- Install npm packages listed in package.json or that are standard Next.js/React ecosystem packages
- Modify existing components, API routes, and lib files
- Update `CLAUDE.md` to reflect new systems
- Run `npm run build` to verify no TypeScript errors
- Run `npm run lint` to verify code quality

## Forbidden Actions

- Do NOT call Sleeper API outside of `src/app/api/cron/` routes (Invariant #1)
- Do NOT delete existing migration files
- Do NOT modify the auth system (it works correctly)
- Do NOT add new environment variables without documenting in `.env.local.example`
- Do NOT push to git or deploy — I will review and push manually
- Do NOT add features or abstractions beyond what is explicitly described above
- Do NOT refactor existing working code unless the change is required for a new system
- Do NOT install UI component libraries (no Material UI, no Chakra) — use Tailwind + custom components

## Stop Conditions

Pause and ask for human review when:
- A migration would drop or rename an existing column
- You need to modify the cron sync logic in a way that changes what data is synced
- Two valid implementation paths exist and the choice affects database schema
- An error cannot be resolved in 2 attempts
- The task requires changes outside the 5 systems described above
- You are unsure whether a change violates any of the 8 invariants

## Checkpoints

After completing each system, output:
✅ **System N complete** — list of files created/modified, migration files added, any API endpoints created.

After all 5 systems are done:
1. Run `npm run build` — must pass with zero errors
2. Run `npm run lint` — must pass
3. Output a full summary of every file changed and every migration added
4. Update `CLAUDE.md` with documentation for all new systems

## Execution Order

Build in this order to manage dependencies:
1. **System 3** (Sleeper Draft Sync) — new migration, cron, UI updates
2. **System 2** (Member Identity Layer) — new page, middleware, cookie logic
3. **System 5** (Cohort Invite Workflow) — wizard redesign, email generator
4. **System 1** (Command Center) — aggregates data from all other systems
5. **System 4** (Situation Room) — depends on draft sync being in place
