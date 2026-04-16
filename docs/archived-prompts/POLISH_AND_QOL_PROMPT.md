# Scranton Branch FFL — Polish & Quality of Life Pass

## Context (carry forward)

You are working on **Scranton Branch FFL**, a Next.js 14 (App Router) fantasy football platform using Supabase (PostgreSQL), Tailwind CSS, and TypeScript. The Season Setup Wizard was just rewritten with a corrected 6-step flow (Start Season → Cohorts → Registrations → Configure & Assign → Draft Order → Sleeper Linking). That wizard is working.

This prompt covers a **polish and QoL pass** across the admin experience: a Reset Season feature, a major Situation Room upgrade with drill-down stats, workflow safety guards, and UI polish throughout.

**Stack:** Next.js 14 App Router, React 18, TypeScript 5, Supabase (PostgreSQL + Realtime), Tailwind CSS 3.4, Zod

**Tailwind theme tokens** (use these, do not invent new ones):
- Backgrounds: `bg-bg-primary` (#0a0e17), `bg-bg-secondary` (#111827), `bg-bg-tertiary` (#1f2937)
- Text: `text-text-primary` (#f9fafb), `text-text-secondary` (#d1d5db), `text-text-muted` (#6b7280)
- Accent: `text-accent-green`, `text-accent-red`, `text-accent-gold`, `text-accent-purple`
- Primary: `bg-primary` (#1a73e8), `bg-primary-dark`
- Cards: `glass-card` (custom utility class for dark glass panels)

**8 Core Invariants** — NEVER violate:
1. Only the cron sync calls Sleeper API for league data (wizard Sleeper fetch is the exception)
2. Every team result has a `member_season_id`
3. Admin routes check auth with `requireAuth()` + cohort scope
4. One active season per org
5. `cohort_id` is nullable on legacy tables
6. League solver is a recommendation, not a mandate
7. Invite tokens are secrets
8. Recaps are per-cohort

---

## Objective

Implement 6 focused improvements across the admin experience. Each is a self-contained feature. Execute them in the order listed.

---

## Starting State

### Key files (read these before making changes):

**Admin pages:**
- `src/app/admin/page.tsx` — Commissioner Command Center (dashboard, auth, phase advancement)
- `src/app/admin/situation-room/page.tsx` — Live draft monitor (287 lines)
- `src/app/admin/season-setup/page.tsx` — Wizard orchestrator
- `src/app/admin/season-setup/steps/Step1StartSeason.tsx` — Season creation step
- `src/app/admin/archive/page.tsx` — Season archive (120 lines)
- `src/app/admin/season/page.tsx` — Season config (separate from wizard)

**APIs:**
- `src/app/api/admin/situation-room/route.ts` — Situation Room data (174 lines)
- `src/app/api/admin/dashboard/route.ts` — Dashboard data
- `src/app/api/admin/season/advance/route.ts` — Phase advancement
- `src/app/api/admin/setup/route.ts` — Season creation
- `src/app/api/admin/archive/route.ts` — Archive endpoint

**Public pages:**
- `src/app/page.tsx` — Home page with placeholder cards

**Database schema (relevant subset — DO NOT modify):**
- `seasons` — id, org_id, season_number, year, status, num_leagues, roster_size_per_league, settings
- `leagues` — id, org_id, season_id, name, short_name, color, position, sleeper_league_id
- `cohorts` — id, org_id, season_id, name, slug, invite_token, color, status, settings
- `season_registrations` — id, cohort_id, member_id, season_id, status
- `member_seasons` — id, member_id, season_id, league_id, draft_position, sleeper_roster_id
- `draft_boards` — id, league_id, season_id, status, num_rounds, sleeper_draft_id, is_mock
- `draft_picks` — id, draft_board_id, member_season_id, round, pick_in_round, overall_pick, player_name, position, picked_at

---

## Feature 1: Reset Season (Danger Zone)

### What to build:
A "Reset Season" capability that lets the commissioner delete an in-progress season and start fresh. This is critical during setup when mistakes happen.

### New API endpoint: `src/app/api/admin/setup/reset/route.ts`

**DELETE handler:**
- Requires `requireAuth()` + `requireSuperAdmin()`  (only super_admin can reset)
- Accepts body: `{ seasonId: string, confirmPhrase: string }`
- The `confirmPhrase` MUST exactly match `"RESET SEASON {seasonNumber}"` (e.g., "RESET SEASON 3"). If it doesn't match, return 400.
- Season MUST be in status: `setup`, `registering`, `confirming`, `pre_draft`, or `drafting`. Do NOT allow reset of `active`, `playoffs`, `completed`, or `archived` seasons — return 403 with message explaining why.
- Cascade delete in this exact order (to respect FK constraints):
  1. `draft_picks` WHERE draft_board_id IN (boards for this season)
  2. `draft_boards` WHERE season_id = seasonId
  3. `member_seasons` WHERE season_id = seasonId
  4. `season_registrations` WHERE season_id = seasonId
  5. `cohorts` WHERE season_id = seasonId
  6. `leagues` WHERE season_id = seasonId
  7. `seasons` WHERE id = seasonId
- Return `{ ok: true, deleted: { picks, boards, memberSeasons, registrations, cohorts, leagues, season: 1 } }` with counts of each deleted entity.
- If ANY delete step fails, return 500 with the step that failed. Do NOT attempt to rollback partial deletes — the commissioner will re-run.

### UI: Add reset button to wizard Step 1 (`Step1StartSeason.tsx`)

When a season exists AND status is one of the resettable statuses:
- Show a collapsible "Danger Zone" section at the bottom of the step, collapsed by default
- Red-bordered card with header "Reset Season"
- Warning text: "This will permanently delete Season {N} and ALL associated data: leagues, cohorts, registrations, member assignments, draft boards, and picks. This cannot be undone."
- Text input: "Type RESET SEASON {N} to confirm" with validation
- Red button: "Reset Season {N}" — disabled until confirm phrase matches exactly
- On success: flash success, call `onComplete()` to refetch progress (wizard will return to Step 1 with no season)

### UI: Also add to admin dashboard (`/admin/page.tsx`)

When a season exists in a resettable status, add a "Reset Season" link in the season summary card (small, text-only, red, at the bottom of the card). Clicking it navigates to `/admin/season-setup` (which will show Step 1 with the danger zone).

---

## Feature 2: Situation Room — Drill-Down Upgrade

### Goal:
Transform the Situation Room from a basic status monitor into a commissioner command post with per-league drill-downs, position breakdowns, team rosters, and activity filtering.

### API changes: `src/app/api/admin/situation-room/route.ts`

Expand the response to include per-board detailed data:

Add to each draft in the `drafts[]` array:
```typescript
{
  // ... existing fields ...
  positionBreakdown: Record<string, number>,  // e.g., { QB: 12, RB: 28, WR: 24, TE: 8, K: 4, DEF: 4 }
  teamRosters: {
    memberSeasonId: string,
    teamName: string,
    picks: { round: number, pick: number, overall: number, playerName: string, position: string }[],
    positionCounts: Record<string, number>,  // per-team position breakdown
  }[],
  recentPicks: // EXPAND from 3 to 10 per board
}
```

Compute `positionBreakdown` by counting positions across all picked players for that board.

Compute `teamRosters` by grouping picks by `member_season_id`, sorting each team's picks by `overall_pick`. Include the position count per team.

Also add to the top-level response:
```typescript
{
  // ... existing ...
  recentActivity: // EXPAND from 20 to 50 items
}
```

### UI rewrite: `src/app/admin/situation-room/page.tsx`

**Keep the existing top bar** (season info, active draft count, global progress) as-is.

**Upgrade the draft cards to be expandable:**

Default (collapsed) view — same as current: league name, status badge, progress circle, current pick, last 3 picks, link to full board.

Expanded view (click card or "Expand" button to toggle):

**Section 1: Position Distribution Bar**
- Horizontal stacked bar chart showing position breakdown for this league's draft
- Each position gets a colored segment: QB=red-400, RB=green-400, WR=blue-400, TE=yellow-400, K=purple-400, DEF=orange-400
- Label each segment with count (e.g., "RB 28")
- Full width of the card

**Section 2: Team Roster Grid**
- Grid of cards, one per team in the league (2 columns on desktop, 1 on mobile)
- Each team card shows:
  - Team name (bold, white)
  - Pick count: "{N}/{totalRounds} picks"
  - Position summary: compact badges like "3 RB · 4 WR · 1 QB · 1 TE"
  - Scrollable pick list: round-pick number + player name (position-colored) for each pick, ordered by round
- Highlight the team that's currently on the clock with a pulsing border using the league color

**Section 3: League Activity Feed**
- The last 10 picks for THIS league only (not the global feed)
- Same format as the global activity feed but filtered to this board
- Shown inside the expanded card

**Upgrade the global activity feed:**

Add a filter bar above the feed:
- League filter: clickable league color dots (toggle on/off, all on by default). Each dot shows the league short name on hover.
- Position filter: clickable position badges (QB, RB, WR, TE, K, DEF) — toggle on/off, all on by default
- Round filter: "Round" dropdown (All, 1, 2, 3... up to max rounds)

Filter state is local (React state). Filter the `activity` array client-side before rendering.

Expand the feed from max-h-64 to max-h-96 and show up to 50 items.

**Add a stats summary row** between the draft cards and the global activity feed:
- 4 stat cards in a row:
  - "Most Drafted Position" — position name + count (e.g., "WR — 47 picks")
  - "Fastest League" — league with most picks made (league name + pick count)
  - "Most Recent Pick" — player name + position + team + time ago
  - "Picks This Hour" — count of picks with `picked_at` within the last 60 minutes

---

## Feature 3: Dashboard Phase Advance Guard

### Problem:
The admin dashboard has a raw "Advance to {status}" button that can desync the wizard by skipping steps.

### Fix in `src/app/admin/page.tsx`:

**Option A (simpler, implement this):** Hide the phase advance button entirely when season status is `setup`, `registering`, `confirming`, `pre_draft`, or `drafting`. These statuses are managed by the wizard. Show a message instead: "Season phase is managed by the Setup Wizard during initial setup." with a link to `/admin/season-setup`.

**Keep the advance button visible** only for statuses `active` → `playoffs`, `playoffs` → `completed`, and `completed` → `archived`. These are post-wizard lifecycle transitions.

**Add a confirmation modal** for the remaining visible transitions:
- `active → playoffs`: "Are you sure? This will end the regular season. Make sure all weekly results are synced."
- `playoffs → completed`: "Are you sure? This marks the season as complete. Run the bracket and confirm the champion first."
- `completed → archived`: redirect to `/admin/archive` instead of advancing inline (the archive page already handles this properly).

The modal: a simple overlay with dark backdrop, white-on-dark card, the warning text, "Cancel" (gray) and "Confirm" (red for destructive, green for safe) buttons. Do NOT add a new dependency for this — build it as a simple React component inline or as a small `ConfirmModal` component in `src/components/admin/`.

---

## Feature 4: Season Config Page Guard

### Problem:
`/admin/season/page.tsx` lets commissioners edit league names, Sleeper IDs, and championship settings independently of the wizard, which can desync state during setup.

### Fix in `src/app/admin/season/page.tsx`:

Add a check at the top of the page. If the current season status is `setup`, `registering`, `confirming`, `pre_draft`, or `drafting`:
- Show a warning banner: "Season {N} is currently being set up. Use the Setup Wizard to make changes during initial configuration." with a prominent link to `/admin/season-setup`.
- Make ALL form fields read-only (disabled inputs).
- Hide the Save button.

When the season is in `active`, `playoffs`, or `completed` status: show the page normally with full editing capability. These are the statuses where mid-season config adjustments are legitimate (e.g., fixing a Sleeper league ID or adjusting championship qualifiers).

---

## Feature 5: Archive Preview + Confirmation Modal

### Problem:
`/admin/archive/page.tsx` has a single checkbox + button with no preview of what will be archived. A commissioner might archive with incomplete data.

### Fix in `src/app/admin/archive/page.tsx`:

**Add an archive preview section** before the confirm button. Fetch the data that WOULD be archived and display it:

Create a new API endpoint `src/app/api/admin/archive/preview/route.ts`:
- GET handler
- Requires `requireAuth()`
- Runs the same data-gathering logic as the POST `/api/admin/archive` (final standings, power rankings, bracket, awards) but does NOT insert or update anything
- Returns: `{ preview: { leagueStandings: { leagueName, teams: { name, wins, losses, pointsFor }[] }[], awards: { champion, mostPoints, bestRecord, topPowerRanked }, bracketStatus: 'complete' | 'in_progress' | 'not_set_up' } }`

**UI changes:**

1. On page load, fetch the preview and display:
   - Per league: top 3 teams with W-L record and points
   - Awards section: champion name, most points team, best record team
   - Bracket status badge: green "Complete" / yellow "In Progress" / red "Not Set Up"
   - If bracket is not complete, show amber warning: "The championship bracket is not complete. Archiving now will freeze incomplete bracket data."

2. Replace the checkbox with a proper confirmation modal (same pattern as Feature 3):
   - "Archive Season {year}" button opens the modal
   - Modal shows: "This will create a permanent snapshot of the {year} season. This action cannot be undone."
   - Confirm button: "Archive {year} Season" (red)
   - Cancel button: "Go Back" (gray)

---

## Feature 6: Home Page — Replace Placeholders with Real Data

### Problem:
The home page (`src/app/page.tsx`) has 4 placeholder cards that say "coming in Phase 2" and "coming in Phase 3." The data for all of these already exists in the database.

### Fix in `src/app/page.tsx`:

This is a server component. Fetch real data and display it.

**Card 1: Live Scores → Current Week Matchups**
- Fetch current NFL week from `getNFLState()` (already in `src/lib/sleeper/api.ts`)
- If season is active and it's during the NFL regular season: show matchup scores for the current week across all leagues
  - Use `getSeasonLeagues()` to get leagues, then for each league call `getWeekMatchups()` with the current week
  - Display: 2-3 matchup previews per league (team A score vs team B score) with league color accent
  - Link: "See all matchups →" to `/leagues/{leagueId}/matchups`
- If off-season or no data: show "Season hasn't started yet" with the current year

**Card 2: Power Rankings → Top 5 Overall**
- Fetch from `computePowerRankings()` (already in `src/lib/sleeper/domain.ts` or wherever power rankings are computed)
- If rankings exist: show top 5 ranked teams with rank number, team name, league badge (colored), and composite score
- Link: "Full rankings →" to `/rankings`
- If no data: "Rankings will appear once the season begins"

**Card 3: Activity Feed → Recent Transactions**
- Fetch recent transactions from `transactions_cache` table (last 5-10 entries)
- Display: transaction type badge (TRADE / WAIVER / FA), player name(s), league badge
- Link: "All transactions →" to `/transactions`
- If no data: "No recent activity"

**Card 4: Championship Bracket → Current Bracket Status**
- Fetch from `loadBracket()` (already in `src/lib/bracket/`)
- If bracket exists and has data: show bracket status (e.g., "Semifinals — 2 of 4 matchups decided"), current champion if determined
- Link: "View bracket →" to `/bracket`
- If no bracket: "Bracket will be set up during playoffs"

**Important:** Each card should gracefully handle the case where data is unavailable (off-season, no season, API error). Use try/catch around each data fetch and fall back to a "no data" message. Do NOT let one card's failure break the whole page.

**Remove** all references to "Phase 2" and "Phase 3" from the card text.

---

## Allowed Actions

- Create new files: `src/app/api/admin/setup/reset/route.ts`, `src/app/api/admin/archive/preview/route.ts`, `src/components/admin/ConfirmModal.tsx`
- Modify existing files listed in Starting State
- Import from existing libraries and `@/lib/*` modules
- Use existing Tailwind theme tokens listed above

## Forbidden Actions

- Do NOT modify the database schema or create Supabase migrations
- Do NOT add new npm dependencies
- Do NOT modify `src/config/constants.ts`
- Do NOT modify the auth system (`src/lib/auth.ts`, `src/lib/auth-scope.ts`)
- Do NOT modify the Season Setup Wizard steps (Steps 2-6) or the wizard orchestrator — only Step1 gets the reset button
- Do NOT modify the cron sync routes
- Do NOT modify the public registration flow (`/register/[token]`)
- Do NOT modify the Sleeper API client (`src/lib/sleeper/`)
- Do NOT add features not described in this prompt
- Only make changes directly requested. Do not add extra files, abstractions, or features.

## Stop Conditions

Pause and ask for human review when:
- The cascade delete in Feature 1 fails due to unexpected FK constraints not listed here
- `requireSuperAdmin()` does not exist in `src/lib/auth.ts` — if missing, describe what's needed and ask before creating it
- The power rankings or bracket data fetching functions have different signatures than expected — list what you found and ask for guidance
- The `transactions_cache` table structure doesn't match what Feature 6 expects
- Any change would affect pages or routes not listed in this prompt
- An error persists after 2 fix attempts

## Checkpoints

After each feature, output:
```
✅ Feature N: {name} complete
Files created: [list]
Files modified: [list]
Key changes: [bullets]
```

After all features, output:
```
✅ POLISH PASS COMPLETE
Total files created: N
Total files modified: N
Features delivered:
1. Reset Season (danger zone + cascade delete)
2. Situation Room drill-downs (position bars, team rosters, activity filters, stats row)
3. Dashboard phase advance guard (hidden during wizard, confirmation modal post-wizard)
4. Season config page guard (read-only during setup)
5. Archive preview + confirmation modal
6. Home page real data (matchups, rankings, transactions, bracket)
Breaking changes: [list any, or "None"]
```

## Verification

After completing all features, verify by reading back the code:
1. **Reset**: Super admin can type "RESET SEASON 3" and delete all season data. Non-super-admin gets 403. Active/completed/archived seasons cannot be reset.
2. **Situation Room**: Expanding a draft card shows position distribution bar, team roster grid, and per-league activity feed. Global feed has league/position/round filters. Stats row shows 4 summary metrics.
3. **Dashboard guard**: Phase advance button hidden during wizard-managed statuses. Visible for active→playoffs→completed with confirmation modal. Completed→archived redirects to archive page.
4. **Season config guard**: During setup/drafting, season config page is read-only with wizard link banner. During active season, fully editable.
5. **Archive preview**: Preview section shows league standings, awards, and bracket status before archiving. Warning shown if bracket incomplete. Confirmation modal replaces bare checkbox.
6. **Home page**: All 4 cards show real data when available, graceful fallbacks when not. No "Phase 2/3" text remaining.
