# Season Setup Wizard — Complete Workflow Rewrite

## Context (carry forward)

You are working on **Scranton Branch FFL**, a Next.js 14 (App Router) fantasy football platform using Supabase (PostgreSQL), Tailwind CSS, TypeScript, and Zod. The project manages multiple Sleeper leagues under one org with cross-league features.

The Season Setup Wizard (`/admin/season-setup`) is the commissioner's tool for spinning up a new NFL season end-to-end. It is currently **broken at two levels**:

1. **Deadlock bug**: Step 1 (Create Cohorts) requires an active season via `getActiveSeasonId()`, but the season doesn't get created until Step 3. The wizard cannot be started from a clean state.
2. **Wrong step order**: The wizard asks the commissioner to configure league count and roster size BEFORE collecting registrations. The commissioner cannot know how many leagues to create or what roster size to set without first knowing how many people signed up. Registration data MUST come before league configuration.

**8 Core Invariants** — NEVER violate these:
1. Only the cron sync calls Sleeper API for league data; everything else reads from Supabase (the setup wizard's Sleeper fetch for roster mapping is the one exception — it's an explicit admin action)
2. Every team result has a `member_season_id`
3. Admin routes check auth scope with `requireAuth()` + cohort scope
4. One active season per org (enforced by partial unique index)
5. `cohort_id` is nullable on legacy tables
6. League solver is a recommendation, not a mandate
7. Invite tokens are secrets (never expose in logged URLs)
8. Recaps are per-cohort

**Season Status Lifecycle** (from `src/config/constants.ts`):
```
setup → registering → confirming → pre_draft → drafting → active → playoffs → completed → archived
```

**Allowed transitions** (`SEASON_STATUS_TRANSITIONS`):
- setup → registering
- registering → confirming | setup
- confirming → pre_draft | registering
- pre_draft → drafting | confirming
- drafting → active | pre_draft
- active → playoffs
- playoffs → completed
- completed → archived

---

## Objective

Rewrite the Season Setup Wizard into a **correct, linear, bulletproof workflow** where the commissioner:
1. First collects interest (cohorts + invite links + registrations)
2. Then reviews who signed up and confirms the roster
3. THEN — with confirmed headcount in hand — configures the season (league count, roster size)
4. Then assigns members to leagues, sets draft order, and links Sleeper

Every step MUST be completable without deadlocks, and every step MUST validate its own preconditions before allowing progression.

---

## Starting State

### Files that exist and will be modified:

**Wizard UI (single 880-line page — will be refactored):**
- `src/app/admin/season-setup/page.tsx`

**API routes (may need modification):**
- `src/app/api/admin/setup/route.ts` — GET (fetch state) + POST (create season + leagues)
- `src/app/api/admin/setup/intake/route.ts` — POST (member confirmations)
- `src/app/api/admin/setup/leagues/route.ts` — POST (randomize/lock league assignments)
- `src/app/api/admin/setup/draft/route.ts` — POST (randomize/lock draft order)
- `src/app/api/admin/setup/sleeper/route.ts` — GET (fetch rosters) + POST (link leagues/rosters)
- `src/app/api/admin/cohorts/route.ts` — GET (list) + POST (create cohort)
- `src/app/api/admin/cohorts/[id]/confirm/route.ts` — POST (confirm/waitlist)
- `src/app/api/admin/cohorts/[id]/registrations/route.ts` — GET
- `src/app/api/admin/cohorts/[id]/promote/route.ts` — POST
- `src/app/api/admin/draft/board/route.ts` — GET + POST (board actions including link-sleeper)

**Config/lib files (may need modification):**
- `src/lib/config.ts` — `getActiveSeasonId()` and related helpers
- `src/config/constants.ts` — status lifecycle, transitions, defaults

**Shared components:**
- `src/components/admin/InviteEmailGenerator.tsx` — email template helper (leave as-is)

### Current database schema (relevant subset — DO NOT modify schema):
- `seasons` — id, org_id, season_number, year, status, num_leagues, roster_size_per_league, settings
- `leagues` — id, org_id, season_id, name, short_name, color, position, sleeper_league_id, cohort_id
- `cohorts` — id, org_id, **season_id** (NOT NULL FK), name, slug, invite_token, color, status, settings
- `season_registrations` — id, cohort_id, member_id, **season_id**, status, registered_at, confirmed_at, waitlist_position
- `members` — id, org_id, full_name, display_name, email, status (active/inactive/alumni)
- `member_seasons` — id, member_id, season_id, league_id, draft_position, sleeper_roster_id, sleeper_display_name, onboard_status
- `draft_boards` — id, league_id, season_id, status, num_rounds, sleeper_draft_id, is_mock, started_at, completed_at
- `draft_picks` — id, draft_board_id, member_season_id, round, pick_in_round, overall_pick, player_name, picked_at

### Critical schema constraint:
The `cohorts` table has a NOT NULL `season_id` foreign key. Cohorts CANNOT exist without a season. This means we cannot create cohorts before creating a season row. However, we CAN create a **lightweight season** first (just year + season number, no league configuration) and defer league setup to a later step after registration data is in.

---

## Target State

### New Step Order (6 steps, matching the real-world commissioner workflow):

```
Step 1: Start Season         — Lightweight: just year + season number. Creates season row (status=setup). NO league configuration yet.
Step 2: Cohorts & Invites    — Create cohorts linked to the new season. Generate invite links. Send emails. Wait for signups.
Step 3: Review Registrations — See who registered per cohort. Confirm/waitlist/promote members. Get your final headcount.
Step 4: Configure & Assign   — NOW pick league count + roster size (informed by headcount). Create leagues. Randomize members into leagues. Lock → creates member_seasons, advances to pre_draft.
Step 5: Draft Order          — Randomize draft order per league. Lock → creates draft_boards + draft_picks (snake draft), advances to drafting.
Step 6: Sleeper Linking      — Link Sleeper league IDs to DB leagues. Map Sleeper rosters to member_seasons. Link Sleeper draft IDs to draft_boards.
```

### Why this order works:
- Step 1 gives us a `season_id` immediately (needed for cohorts and registrations FK constraints) without forcing league decisions
- Step 2 uses the season_id to create cohorts and send invites — commissioner waits for signups
- Step 3 shows registration data and locks in who's playing — commissioner now knows the headcount
- Step 4 is where league config happens — commissioner sees "20 confirmed members" and decides 2 leagues of 10 vs 4 leagues of 5
- Steps 5-6 proceed as before

### What MUST be true when done:

1. **A commissioner can open the wizard with zero seasons in the database and complete every step sequentially without errors.**
2. **Step 1 creates a lightweight season** — only year and season_number. The `num_leagues` and `roster_size_per_league` fields are set to sensible defaults (2 and 10) but will be overwritten in Step 4. No leagues are created in Step 1.
3. **Step 2 creates cohorts using the season_id from Step 1.** The `POST /api/admin/cohorts` works because `getActiveSeasonId()` finds the season with status=setup.
4. **Step 3 reads registrations from the database**, not from ephemeral React state. Confirmations happen through the existing cohort confirm/promote endpoints.
5. **Step 4 is the critical new step** — it combines league configuration (previously Step 3's form) with league assignment (previously Step 3b). The commissioner sees confirmed headcount, picks league count + roster size + names, creates leagues, randomizes assignment, and locks. Locking creates `member_seasons` and advances season to `pre_draft`.
6. **Steps 5-6 work as before** but with proper precondition checks.
7. **Every step shows a clear completion indicator** and the wizard remembers progress based on season status + data presence.
8. **The step indicator tabs are clickable** for completed steps (review mode) but future steps cannot be skipped.
9. **Flash messages persist until manually dismissed** (X button) instead of auto-clearing after 4 seconds.
10. **All wizard state derives from server data.** Refreshing the browser resumes at the correct step. Zero ephemeral state that can be lost.

---

## Execution Order

Execute these changes in this exact sequence. Complete each phase fully before moving to the next.

### Phase 1: Fix the API layer (backend first)

**1a. Modify `src/app/api/admin/setup/route.ts` POST handler — make season creation lightweight:**

Current behavior: requires `year`, `numLeagues`, `leagueNames[]`, `rosterSize` and creates season + league rows together.

New behavior:
- Accept ONLY `year` (required).
- Accept optional `numLeagues`, `leagueNames[]`, `rosterSize` — if provided, create leagues too (backward compatible). If omitted, create the season row only with `num_leagues` set to 0 and `roster_size_per_league` set to 0 as placeholder values.
- When `numLeagues` is not provided, do NOT create league rows. Those get created in Step 4.
- Keep the conflict check (no other season in setup/pre_draft/drafting/active). Enhance the error message: include the conflicting season's number, year, and status so the commissioner knows what to deal with.
- Keep the rollback logic if league insert fails (only relevant when leagues are created).

**1b. Create `src/app/api/admin/setup/leagues/configure/route.ts` — new endpoint for Step 4 league configuration:**

POST handler:
- Accepts: `seasonId`, `numLeagues` (1-4), `leagueNames[]` (must match numLeagues), `rosterSize` (4-16)
- Validations: same as current setup POST (year range removed since season already exists, but league count, names, and roster size validated identically)
- Preconditions:
  - Season MUST exist and be in status `setup`, `registering`, or `confirming`
  - Season MUST NOT already have leagues (prevents double-creation). If leagues exist, return 409: "Leagues already configured for this season. Delete existing leagues first or use a different endpoint to modify."
- Operations:
  - Update the season row: set `num_leagues` and `roster_size_per_league`
  - Create league rows with name, short_name (from `DEFAULT_LEAGUE_SHORT_NAMES`), color (from `DEFAULT_LEAGUE_COLORS`), position
  - On league insert failure, rollback the season field updates
- Returns: `{ season, leagues }` (201)
- Uses `requireAuth()` + same org resolution as other setup routes

**1c. Verify `src/app/api/admin/cohorts/route.ts` POST handler works with setup-status season:**

The `getActiveSeasonId()` in `src/lib/config.ts` already queries:
```sql
status IN ('active', 'drafting', 'playoffs', 'pre_draft', 'setup', 'registering', 'confirming')
```
This includes `setup`, so a season created in Step 1 will be found. Read the code to confirm there are no other blockers. If the POST works as-is with a setup-status season, document that in your checkpoint. If not, fix whatever blocks it.

**1d. Create `src/app/api/admin/setup/progress/route.ts` — single endpoint for full wizard state:**

GET handler returns:
```typescript
{
  season: Season | null,               // Current setup-phase season or null
  nextSeasonNumber: number,             // Auto-increment for display
  leagues: League[],                    // Leagues for this season (empty until Step 4)
  cohorts: CohortWithCount[],           // Cohorts with registration counts
  confirmedMemberCount: number,         // Total confirmed + promoted across all cohorts
  totalRegisteredCount: number,         // Total registered (any status) across all cohorts
  members: Member[],                    // All org members
  memberSeasons: MemberSeason[],        // Member-season assignments (empty until Step 4 lock)
  draftBoards: DraftBoard[],            // Draft boards (empty until Step 5 lock)
  currentStep: number,                  // Computed from data state (see logic below)
  stepCompletion: {                     // Per-step completion booleans
    season: boolean,
    cohorts: boolean,
    registrations: boolean,
    leagues: boolean,
    draft: boolean,
    sleeper: boolean,
  }
}
```

`currentStep` computation (server-side, deterministic from data):
```
if no season exists → 1
if season exists AND leagues.length === 0 AND cohorts.length === 0 → 2
  (season created but no cohorts yet — commissioner needs to create cohorts)
if season exists AND cohorts.length > 0 AND confirmedMemberCount === 0 → 3
  (cohorts exist, waiting for registrations and confirmations)
if season exists AND confirmedMemberCount > 0 AND leagues.length === 0 → 4
  (members confirmed but leagues not yet configured)
if season exists AND leagues.length > 0 AND memberSeasons.length === 0 → 4
  (leagues configured but not yet assigned — still in Step 4)
if season exists AND memberSeasons.length > 0 AND season.status === 'pre_draft' → 5
  (leagues locked, draft order next)
if season exists AND season.status === 'drafting' → 6
  (draft locked, Sleeper linking next)
if season exists AND season.status IN ('active', 'playoffs', 'completed') → 7
  (wizard complete)
```

IMPORTANT edge case: if `cohorts.length === 0` but the season exists, currentStep should be 2 (not 3 or 4) regardless of other state. The commissioner MUST create at least one cohort before anything else happens.

`stepCompletion` derivation:
- `season`: season !== null
- `cohorts`: cohorts.length > 0
- `registrations`: confirmedMemberCount > 0
- `leagues`: memberSeasons.length > 0 (leagues are "complete" when assignment is locked, not just when league rows exist)
- `draft`: draftBoards.length > 0 AND every non-mock board has status !== 'pending'
- `sleeper`: leagues.length > 0 AND every league has a non-null sleeper_league_id (this one is intentionally loose — partial linking is OK, this just tracks full completion)

**1e. Modify `src/app/api/admin/setup/intake/route.ts` — work from registration data, not local state:**

Current behavior: accepts `seasonId` + `confirmations` map (memberId → confirmed/declined/pending), updates `members.status`.

New behavior:
- Accept `seasonId` only. No `confirmations` map.
- Query all `season_registrations` for this season with status IN ('confirmed', 'promoted')
- For each confirmed registration, ensure the linked `members` row has status='active'
- Return `{ ok: true, activatedCount: number }`
- Keep the existing auth check

**1f. Modify `src/app/api/admin/setup/leagues/route.ts` — handle the case where leagues were just created in Step 4:**

Current `randomize` action fetches all members with status='active' from the org. This is too broad — it should only randomize members who are confirmed for THIS season.

Update the `randomize` action:
- Instead of querying all active members, query `season_registrations` with status IN ('confirmed', 'promoted') for the given seasonId
- Join to get member details
- Shuffle and round-robin ONLY these confirmed members into the season's leagues
- This ensures only registered+confirmed members get assigned, not every active member in the org

The `lock` action can stay as-is since it works from the assignments map.

### Phase 2: Rewrite the wizard UI

**2a. Break the monolith into step components.**

Create a `steps/` directory and these files:
- `src/app/admin/season-setup/page.tsx` — Orchestrator (state, navigation, progress fetching)
- `src/app/admin/season-setup/steps/Step1StartSeason.tsx`
- `src/app/admin/season-setup/steps/Step2Cohorts.tsx`
- `src/app/admin/season-setup/steps/Step3Registrations.tsx`
- `src/app/admin/season-setup/steps/Step4ConfigureAndAssign.tsx`
- `src/app/admin/season-setup/steps/Step5DraftOrder.tsx`
- `src/app/admin/season-setup/steps/Step6SleeperLinking.tsx`

**2b. Orchestrator page (`page.tsx`):**
- On mount, calls `GET /api/admin/setup/progress` to hydrate all wizard state.
- Stores: `currentStep`, `viewingStep` (for navigating to completed steps), `stepCompletion`, and all entity data.
- Renders the step indicator bar at the top (6 tabs).
- Renders ONLY the step component matching `viewingStep`.
- Step indicator rules:
  - Completed steps: green background with ✓ icon, CLICKABLE (sets `viewingStep`)
  - Current step: blue/primary background, active
  - Future steps: gray background, NOT clickable, cursor-not-allowed
- After any mutation, calls `fetchProgress()` which re-GETs from the progress endpoint. This is the ONLY way state updates — no optimistic local mutations.
- Flash message component: fixed position below step bar, red (error) or green (success), persists until user clicks ✕. Do NOT auto-clear. Store as `{ message: string, type: 'error' | 'success' } | null`.
- Callback pattern: each step component receives `onComplete: () => void` which triggers `fetchProgress()` and auto-advances `viewingStep` to the new `currentStep`.

**2c. Step 1: Start Season (`Step1StartSeason.tsx`)**

Props: `season`, `nextSeasonNumber`, `onComplete`, `flash`

If no season:
- Header: "Step 1: Start Season"
- Subheader: "Create Season {nextSeasonNumber} to get started. You'll configure leagues later after registration."
- Form fields:
  - **NFL Year** — number input, default current year, range 2020-2040
  - That's it. Just the year. League config comes in Step 4.
- Submit button: "Start Season {nextSeasonNumber}" (blue/primary)
- On submit: POST `/api/admin/setup` with `{ year }` only (no numLeagues, no leagueNames, no rosterSize)
- On success: flash("Season {N} created", "success"), call onComplete()

If season exists (viewing completed step):
- Read-only card: "Season {season.season_number} — {season.year}" with green "Created" badge
- "Continue to Cohorts →" button

**2d. Step 2: Cohorts & Invites (`Step2Cohorts.tsx`)**

Props: `season`, `cohorts`, `onComplete`, `flash`

Requires: season exists

- Header: "Step 2: Cohorts & Invites"
- Subheader: "Create cohorts for different groups, send invite links, and wait for signups."

Existing cohorts list (if any):
- Per cohort card:
  - Color dot + name + status badge (open/closed)
  - Registration count: "{N} registered" (or "{N}/{max}" if capacity set)
  - Progress bar (if capacity set)
  - Actions row:
    - "Copy Invite Link" button — copies `{origin}/register/{token}` to clipboard, shows "Copied!" for 2s
    - "Generate Email" button — toggles `InviteEmailGenerator` component inline
    - "View Registrations" button — fetches and shows registrations inline

Create New Cohort form (always visible at bottom):
- Fields: Name (required text input), Color (color picker, default #3b82f6), Max Capacity (optional number)
- Submit: "Create Cohort" button
- On submit: POST `/api/admin/cohorts` with `{ name, color, settings: { maxCapacity } }`
- On success: flash, refetch progress

Navigation:
- "Continue to Review Registrations →" button — enabled only when cohorts.length > 0
- Below the button, show hint text when 0 cohorts: "Create at least one cohort to continue"
- When cohorts exist but 0 registrations: show hint "Waiting for signups... share your invite links and come back when people have registered"

**2e. Step 3: Review Registrations (`Step3Registrations.tsx`)**

Props: `season`, `cohorts`, `confirmedMemberCount`, `totalRegisteredCount`, `onComplete`, `flash`

Requires: at least one cohort exists

- Header: "Step 3: Review Registrations"
- Summary banner at top: "{confirmedMemberCount} confirmed / {totalRegisteredCount} total registered across {cohorts.length} cohort(s)"
  - Color-coded: green if confirmedMemberCount > 0, yellow if totalRegisteredCount > 0 but confirmedMemberCount === 0, gray if totalRegisteredCount === 0

Per cohort section:
- Cohort header: color dot + name + "{N} registered"
- "Load Registrations" button — calls `GET /api/admin/cohorts/{id}/registrations`
- When loaded, shows list of registrations:
  - Per row: member name, email, status badge (registered=blue, confirmed=green, waitlisted=yellow, promoted=green)
- Action buttons per cohort:
  - "Confirm All (max {capacity})" — calls `POST /api/admin/cohorts/{id}/confirm` with `{ maxSlots }`
  - "Promote from Waitlist" — calls `POST /api/admin/cohorts/{id}/promote`
  - Both refetch progress after success

Navigation:
- "Continue to Configure Leagues →" button — enabled only when confirmedMemberCount > 0
- When confirmedMemberCount === 0: show hint "Confirm at least one registered member before configuring leagues"

**2f. Step 4: Configure Leagues & Assign (`Step4ConfigureAndAssign.tsx`)**

Props: `season`, `leagues`, `members`, `memberSeasons`, `confirmedMemberCount`, `onComplete`, `flash`

Requires: confirmedMemberCount > 0

This step has two sub-phases: **4a. Configure** (if no leagues yet) and **4b. Assign** (once leagues exist).

**Sub-phase 4a: Configure Leagues** (shown when `leagues.length === 0`):
- Header: "Step 4: Configure Leagues"
- Info banner: "You have **{confirmedMemberCount} confirmed members**. Choose how to divide them into leagues."
- Smart suggestion row: display calculated options like "2 leagues × 10 players" or "4 leagues × 5 players" based on confirmedMemberCount. These are clickable presets that auto-fill the form.
- Form fields:
  - **Number of Leagues** — dropdown 1-4, default calculated from `Math.round(confirmedMemberCount / 10)` clamped to 1-4
  - **Roster Size per League** — number input 4-16, default calculated from `Math.ceil(confirmedMemberCount / numLeagues)`
  - **League Names** — dynamic text inputs (one per league), pre-filled from `DEFAULT_LEAGUE_NAMES`
  - **Headcount check**: show warning if `numLeagues * rosterSize !== confirmedMemberCount`: "Note: {numLeagues} × {rosterSize} = {product} slots but you have {confirmedMemberCount} confirmed members. {difference} member(s) will be unassigned." Only show if there's a mismatch.
- Submit button: "Create Leagues"
- On submit:
  1. First call `POST /api/admin/setup/intake` with `{ seasonId }` to activate all confirmed members
  2. Then call `POST /api/admin/setup/leagues/configure` with `{ seasonId, numLeagues, leagueNames, rosterSize }`
  3. On success: flash("Leagues created"), refetch progress (sub-phase 4b will now render)

**Sub-phase 4b: League Assignment** (shown when `leagues.length > 0` AND `memberSeasons.length === 0`):
- Header: "Step 4b: Assign Members to Leagues"
- Info: "{confirmedMemberCount} members → {leagues.length} leagues"
- Randomize button: calls `POST /api/admin/setup/leagues` with `{ seasonId, action: 'randomize' }`
  - Shows results in a grid: one card per league, listing assigned member names
- Re-roll button: calls randomize again
- Lock button: "Lock League Assignments" calls `POST /api/admin/setup/leagues` with `{ seasonId, action: 'lock', assignments }`
  - Creates `member_seasons` and advances season status to `pre_draft`
- On lock success: flash, call onComplete()

**After both sub-phases complete** (viewing step 4 after progression):
- Read-only: league cards showing assigned members, green "Locked" badge

**2g. Step 5: Draft Order (`Step5DraftOrder.tsx`)**

Props: `season`, `leagues`, `memberSeasons`, `members`, `draftBoards`, `onComplete`, `flash`

Requires: season.status === 'pre_draft', memberSeasons exist

- Header: "Step 5: Draft Order"
- Randomize button: calls `POST /api/admin/setup/draft` with `{ seasonId, action: 'randomize' }`
  - Shows per-league draft order: numbered list of member names
- Re-roll button
- Lock button: "Lock Draft Order & Generate Pick Slots"
  - Calls `POST /api/admin/setup/draft` with `{ seasonId, action: 'lock', draftOrders }`
  - Creates draft_boards + snake draft picks, advances season to `drafting`
- On lock success: flash, call onComplete()

After locking (viewing completed):
- Read-only: draft order per league with green "Locked" badge

**2h. Step 6: Sleeper Linking (`Step6SleeperLinking.tsx`)**

Props: `season`, `leagues`, `memberSeasons`, `members`, `draftBoards`, `flash`

Requires: season.status === 'drafting', draftBoards exist

- Header: "Step 6: Link Sleeper Leagues"
- Subheader: "Connect each league to its Sleeper league, map rosters, and link drafts."

Per league section:
- League name header
- **Sleeper League ID** input — accepts URL (`sleeper.com/leagues/(\d+)`) or raw numeric ID. Auto-extracts from URL.
- "Fetch Rosters" button — calls `GET /api/admin/setup/sleeper?sleeper_league_id={id}`
- **Roster mapping** (shown after fetch): dropdown per member_season matching to a Sleeper roster entry
- **Sleeper Draft ID** input — for linking the draft board
- "Link Draft" button per league — calls `POST /api/admin/draft/board` with `{ boardId, action: 'link-sleeper', sleeperDraftId }`
- Per-league completion checklist:
  - ✓ League ID linked / ✗ Not linked
  - ✓ All rosters mapped / ✗ {N} unmapped
  - ✓ Draft linked / ✗ Not linked

Global actions:
- "Save All Sleeper Links" button — calls `POST /api/admin/setup/sleeper` with `{ seasonId, leagueLinks, rosterMappings }`
- When all leagues fully linked: show "Season Setup Complete!" success banner with "Go to Dashboard →" link to `/admin`
- Partial linking is OK — commissioner can save progress and come back

### Phase 3: Handle edge cases and contingencies

**3a. Stale season handling:**
- If a season exists in `setup` status from a previous abandoned attempt, the wizard resumes from wherever they left off. The progress endpoint determines currentStep from data state, not from when the session started.

**3b. Season conflict resolution:**
- If a season in `active` or `drafting` already exists when the commissioner opens the wizard, Step 1 shows: "Season {N} ({year}) is currently in **{status}** status. You must complete or archive it from the Admin Dashboard before starting a new season." with a "Go to Admin Dashboard →" link.
- Do NOT add archive/complete functionality inside the wizard.

**3c. Zero registrations:**
- Step 3 with zero registrations across all cohorts: show per-cohort "No registrations yet" and the summary shows "0 confirmed / 0 registered". The "Continue" button is disabled with hint text: "Share your invite links and come back when members have signed up."
- This is the expected "waiting" state — the commissioner creates cohorts, sends links, and comes back days later.

**3d. Member count mismatch:**
- Step 4: if confirmedMemberCount is not evenly divisible by numLeagues, the wizard shows a clear warning but does NOT block. Some members won't be assigned. The commissioner can adjust league count or roster size to fix this.

**3e. Partial Sleeper linking:**
- Step 6 tracks per-league completion independently. Saving is always available regardless of completion state. The wizard does NOT require 100% Sleeper linking.

**3f. Browser refresh resilience:**
- ALL wizard state derives from `GET /api/admin/setup/progress`. Refreshing the page re-fetches and resumes at the correct step. Zero ephemeral state can be lost.

**3g. Going backward (clicking completed step tabs):**
- Step 1 (Season): read-only after creation (year cannot change mid-setup)
- Step 2 (Cohorts): fully editable — can add more cohorts, copy links, view registrations
- Step 3 (Registrations): fully editable — can confirm/promote additional members (useful if late signups come in)
- Step 4 (Leagues): read-only AFTER locking (league assignments are immutable once member_seasons exist). Before locking, fully editable.
- Step 5 (Draft): read-only AFTER locking (draft order is immutable once draft_boards/picks exist). Before locking, fully editable.
- Step 6 (Sleeper): always editable (links can be updated anytime)

**3h. Late registrations after Step 4 lock:**
- If new members register after leagues are locked, they will show up in Step 3 as unconfirmed registrations. The commissioner can confirm them but they won't be in a league yet. Show a notice in Step 3: "Note: {N} members confirmed after league assignment was locked. They will need to be manually added to leagues." (This is a future feature — for now, just surface the information.)

---

## Allowed Actions

- Create new files in `src/app/admin/season-setup/steps/`
- Create the new `src/app/api/admin/setup/progress/route.ts` endpoint
- Create the new `src/app/api/admin/setup/leagues/configure/route.ts` endpoint
- Modify existing files listed in the Starting State section
- Import from existing libraries: React, Next.js, Tailwind CSS classes, existing `@/lib/*` and `@/config/*` modules
- Use the existing `InviteEmailGenerator` component as-is
- Use the existing Tailwind theme classes: `glass-card`, `bg-bg-tertiary`, `text-text-muted`, `text-text-secondary`, `text-accent-green`, `text-accent-red`, `bg-primary`, `bg-primary-dark`, `text-accent-gold`, `text-accent-purple`, `bg-accent-green`, `bg-accent-purple`

## Forbidden Actions

- Do NOT modify the database schema or create new Supabase migrations
- Do NOT add new npm dependencies
- Do NOT modify any files outside of: `src/app/admin/season-setup/`, `src/app/api/admin/setup/`, `src/app/api/admin/cohorts/`, `src/app/api/admin/draft/board/route.ts`, and `src/lib/config.ts`
- Do NOT modify the auth system (`src/lib/auth.ts`, `src/lib/auth-scope.ts`)
- Do NOT modify `src/config/constants.ts` (status lifecycle and transitions are correct)
- Do NOT modify the cron sync, public-facing pages, or any non-admin routes
- Do NOT add features not described in this prompt
- Do NOT refactor files not part of the wizard flow
- Do NOT use `localStorage` or `sessionStorage` — all state comes from the server
- Only make changes directly requested. Do not add features or refactor beyond what was asked.

## Stop Conditions

Pause and ask for human review when:
- The `cohorts.season_id` column is truly NOT NULL and the Supabase insert fails without a season_id — if so, describe the exact error and propose the minimal schema change needed (we will approve or reject it)
- The `seasons.num_leagues` or `seasons.roster_size_per_league` columns have NOT NULL constraints that prevent inserting with 0 or null — describe the exact constraint and propose a workaround
- The existing API routes have additional callers beyond the wizard that you would break by modifying them — list the callers
- Any change would affect the public registration flow (`/register/[token]`)
- You need to modify `SEASON_STATUS_TRANSITIONS` or add new status values
- Two valid implementation paths exist and the choice affects V2 features (Command Center, Situation Room, Member Identity Layer)
- An error persists after 2 fix attempts

## Checkpoints

After each phase, output:
```
✅ Phase N complete
Files created: [list with full paths]
Files modified: [list with full paths]
Key changes: [bullet list of what changed and why]
```

After all phases, output a final summary:
```
✅ WIZARD REWRITE COMPLETE
Total files created: N
Total files modified: N
New API endpoints: [list]
Step order: 1.Start Season → 2.Cohorts & Invites → 3.Review Registrations → 4.Configure & Assign Leagues → 5.Draft Order → 6.Sleeper Linking
Breaking changes: [list any, or "None"]
Full file list: [every file touched]
```

## Verification

After completing all phases, verify by reading back the finished code and confirming:
1. **Clean start**: No seasons in DB → wizard loads → Step 1 shows year input only → no "No active season" errors anywhere.
2. **Season creation**: Submit year → season row created with status=setup → wizard advances to Step 2.
3. **Cohort creation**: On Step 2, "Create Cohort" succeeds → cohort linked to season_id → invite link works.
4. **Registration flow**: Registrations confirmed in Step 3 → confirmedMemberCount updates → "Continue to Configure Leagues" button enables.
5. **League config with headcount**: Step 4 shows "{N} confirmed members" → commissioner picks league count and roster size → leagues created → randomize and lock → member_seasons exist → season advances to pre_draft.
6. **Draft order**: Step 5 randomize and lock → draft_boards + draft_picks created → season advances to drafting.
7. **Sleeper linking**: Step 6 link Sleeper IDs, map rosters, link drafts → completion indicators show progress.
8. **Refresh resilience**: Refresh browser at ANY step → wizard resumes at correct step with all data intact.
9. **Backward navigation**: Click completed step tab → shows step data → can edit where allowed → clicking current step tab returns to active work.
