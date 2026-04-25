import { createServiceClient } from '@/lib/supabase/server';
import { getActiveSeasonId } from '@/lib/config';
import type { SleeperRoster, SleeperMatchup } from '@/lib/sleeper/types';
import type { LeagueTeam, MatchupPair } from '@/lib/sleeper/league-data';

type SnapshotRow = {
  standings: SleeperRoster[] | null;
  matchups: SleeperMatchup[] | null;
  fetched_at: string;
};

type MemberRecord = {
  fullName: string | null;
  displayName: string | null;
  sleeperDisplayName: string | null;
};

async function loadSnapshot(
  sleeperLeagueId: string,
  week: number,
): Promise<SnapshotRow | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('league_snapshots')
    .select('standings, matchups, fetched_at')
    .eq('league_id', sleeperLeagueId)
    .eq('week', week)
    .maybeSingle();
  return (data as SnapshotRow | null) ?? null;
}

async function loadRosterMembers(
  sleeperLeagueId: string,
  seasonId: string,
): Promise<Map<number, MemberRecord>> {
  const supabase = createServiceClient();
  const result = new Map<number, MemberRecord>();

  const { data: leagueRow } = await supabase
    .from('leagues')
    .select('id')
    .eq('season_id', seasonId)
    .eq('sleeper_league_id', sleeperLeagueId)
    .maybeSingle();
  if (!leagueRow) return result;

  const { data: rows } = await supabase
    .from('member_seasons')
    .select('sleeper_roster_id, sleeper_display_name, members(full_name, display_name)')
    .eq('league_id', leagueRow.id);
  if (!rows) return result;

  for (const row of rows) {
    if (!row.sleeper_roster_id) continue;
    const member = row.members as unknown as
      | { full_name?: string | null; display_name?: string | null }
      | null;
    result.set(Number(row.sleeper_roster_id), {
      fullName: member?.full_name ?? null,
      displayName: member?.display_name ?? null,
      sleeperDisplayName: row.sleeper_display_name ?? null,
    });
  }
  return result;
}

function buildLeagueTeam(
  roster: SleeperRoster,
  member: MemberRecord | undefined,
): LeagueTeam {
  const fpts =
    (roster.settings?.fpts ?? 0) + ((roster.settings?.fpts_decimal ?? 0) / 100);
  const fptsAgainst =
    (roster.settings?.fpts_against ?? 0) +
    ((roster.settings?.fpts_against_decimal ?? 0) / 100);
  const displayName =
    member?.displayName ||
    member?.fullName ||
    member?.sleeperDisplayName ||
    `Team ${roster.roster_id}`;

  return {
    rosterId: roster.roster_id,
    userId: roster.owner_id ?? '',
    username: member?.sleeperDisplayName ?? 'Unknown',
    displayName,
    teamName: member?.fullName ?? null,
    avatar: null,
    wins: roster.settings?.wins ?? 0,
    losses: roster.settings?.losses ?? 0,
    ties: roster.settings?.ties ?? 0,
    pointsFor: fpts,
    pointsAgainst: fptsAgainst,
    streak: roster.metadata?.streak ?? null,
    waiverPosition: roster.settings?.waiver_position ?? 0,
    totalMoves: roster.settings?.total_moves ?? 0,
  };
}

/**
 * Build MatchupPair[] for a given league/week from cached `league_snapshots`,
 * resolving display names through `member_seasons` -> `members`.
 *
 * Falls back to "Team {roster_id}" only when no member identity exists.
 * Returns [] when no snapshot has been written yet (e.g. pre-season).
 */
export async function getCachedWeekMatchups(
  sleeperLeagueId: string,
  week: number,
): Promise<MatchupPair[]> {
  const seasonId = await getActiveSeasonId();
  const snapshot = await loadSnapshot(sleeperLeagueId, week);
  if (!snapshot) return [];

  const memberMap = seasonId
    ? await loadRosterMembers(sleeperLeagueId, seasonId)
    : new Map<number, MemberRecord>();

  const rosters = snapshot.standings ?? [];
  const matchups = snapshot.matchups ?? [];

  const teamByRoster = new Map<number, LeagueTeam>();
  for (const roster of rosters) {
    teamByRoster.set(
      roster.roster_id,
      buildLeagueTeam(roster, memberMap.get(roster.roster_id)),
    );
  }

  const grouped: Record<number, SleeperMatchup[]> = {};
  for (const m of matchups) {
    if (!m.matchup_id) continue;
    if (!grouped[m.matchup_id]) grouped[m.matchup_id] = [];
    grouped[m.matchup_id].push(m);
  }

  const pairs: MatchupPair[] = [];
  for (const matchupId of Object.keys(grouped)) {
    const sides = grouped[Number(matchupId)];
    if (sides.length < 2) continue;
    const [a, b] = sides;
    const teamA = teamByRoster.get(a.roster_id);
    const teamB = teamByRoster.get(b.roster_id);
    if (!teamA || !teamB) continue;

    pairs.push({
      matchupId: Number(matchupId),
      team1: {
        team: teamA,
        points: a.points ?? 0,
        starters: a.starters ?? [],
        startersPoints: a.starters_points ?? [],
        players: a.players ?? [],
        playersPoints: a.players_points ?? {},
      },
      team2: {
        team: teamB,
        points: b.points ?? 0,
        starters: b.starters ?? [],
        startersPoints: b.starters_points ?? [],
        players: b.players ?? [],
        playersPoints: b.players_points ?? {},
      },
    });
  }
  return pairs;
}

/**
 * Latest week with a cached snapshot for this league.
 * Returns 1 when no snapshots exist (graceful empty state).
 */
export async function getCachedMaxWeek(sleeperLeagueId: string): Promise<number> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('league_snapshots')
    .select('week, fetched_at')
    .eq('league_id', sleeperLeagueId)
    .order('week', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.week ?? 1;
}

/**
 * Most recent snapshot metadata for this league. Used to drive `isLive`
 * without calling Sleeper's NFL state endpoint at request time.
 */
export async function getLatestSnapshotInfo(
  sleeperLeagueId: string,
): Promise<{ week: number; fetchedAt: string } | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('league_snapshots')
    .select('week, fetched_at')
    .eq('league_id', sleeperLeagueId)
    .order('week', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return { week: data.week, fetchedAt: data.fetched_at };
}

/**
 * Returns true when the snapshot was written within `windowMs` of now.
 * Helper kept outside React render scope so callers don't trip
 * `react-hooks/purity` on `Date.now()`.
 */
export function isSnapshotFresh(fetchedAt: string, windowMs: number): boolean {
  return Date.now() - new Date(fetchedAt).getTime() < windowMs;
}

const BENCH_SLOTS = new Set(['BN', 'IR', 'TAXI']);

/**
 * Read cached `roster_positions` from the leagues row, filter out bench/IR
 * slots (matching the historical `getLeagueRosterPositions` behaviour), and
 * return the ordered list used to label starter slots in MatchupCard.
 *
 * Caller passes the leagues primary key so we resolve to the right
 * (season, league) row even if a Sleeper league_id is ever reused across
 * seasons. Returns [] when the column is null/empty — MatchupCard already
 * falls back to "BN" when a slot label is missing, so the lineup still
 * renders gracefully on a fresh deploy before the first cron tick.
 */
export async function getCachedRosterPositions(dbLeagueId: string): Promise<string[]> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('leagues')
    .select('roster_positions')
    .eq('id', dbLeagueId)
    .maybeSingle();

  const positions = data?.roster_positions;
  if (!Array.isArray(positions)) return [];
  return positions.filter(
    (pos): pos is string => typeof pos === 'string' && !BENCH_SLOTS.has(pos),
  );
}
