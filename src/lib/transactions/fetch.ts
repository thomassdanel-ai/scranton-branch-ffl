import { createServiceClient } from '@/lib/supabase/server';
import { getSeasonLeagues, getSeasonStatus, type LeagueInfo } from '@/lib/config';
import type { SleeperTransaction } from '@/lib/sleeper/types';
import type { LeagueTeam } from '@/lib/sleeper/league-data';

export type EnrichedTransaction = SleeperTransaction & {
  leagueId: string;
  leagueName: string;
  leagueShortName: string;
  leagueColor: string;
  teams: Record<number, LeagueTeam>;
};

/**
 * Build a `Record<rosterId, LeagueTeam>` per Sleeper league for the given
 * leagues, sourced entirely from `member_seasons` -> `members` (no Sleeper).
 *
 * The TransactionCard UI only consumes `team.teamName ?? team.displayName`,
 * so the returned LeagueTeam shape is intentionally minimal — record / point
 * fields stay zeroed because they are not surfaced from this code path.
 */
async function loadTeamsByLeague(
  leagues: LeagueInfo[],
): Promise<Record<string, Record<number, LeagueTeam>>> {
  const dbToSleeper = new Map<string, string>();
  for (const l of leagues) {
    if (l.dbId && l.sleeperId) dbToSleeper.set(l.dbId, l.sleeperId);
  }
  const byLeague: Record<string, Record<number, LeagueTeam>> = {};
  if (dbToSleeper.size === 0) return byLeague;

  const supabase = createServiceClient();
  const { data: rows } = await supabase
    .from('member_seasons')
    .select('league_id, sleeper_roster_id, sleeper_display_name, members(full_name, display_name)')
    .in('league_id', Array.from(dbToSleeper.keys()));

  if (!rows) return byLeague;

  for (const row of rows) {
    if (!row.sleeper_roster_id || !row.league_id) continue;
    const sleeperLeagueId = dbToSleeper.get(row.league_id);
    if (!sleeperLeagueId) continue;

    const member = row.members as unknown as
      | { full_name?: string | null; display_name?: string | null }
      | null;
    const fullName = member?.full_name ?? null;
    const displayName = member?.display_name ?? null;
    const sleeperHandle = row.sleeper_display_name ?? null;
    const rosterId = Number(row.sleeper_roster_id);

    const friendly =
      displayName || fullName || sleeperHandle || `Team ${rosterId}`;

    const team: LeagueTeam = {
      rosterId,
      userId: '',
      username: sleeperHandle ?? 'Unknown',
      displayName: friendly,
      teamName: null,
      avatar: null,
      wins: 0,
      losses: 0,
      ties: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      streak: null,
      waiverPosition: 0,
      totalMoves: 0,
    };

    byLeague[sleeperLeagueId] ??= {};
    byLeague[sleeperLeagueId][rosterId] = team;
  }

  return byLeague;
}

/**
 * Build the unified Wire feed for the public /transactions page.
 *
 * Reads exclusively from `transactions_cache` (populated by cron) and
 * resolves team identities through `member_seasons` -> `members`. No
 * Sleeper calls — if the cache is empty (fresh install, pre-season, or
 * a season with no completed transactions) we return an empty list so the
 * UI shows its graceful empty state.
 */
export async function getAllTransactions(): Promise<EnrichedTransaction[]> {
  const status = await getSeasonStatus();
  if (!status.seasonId) return [];

  const leagues = await getSeasonLeagues(status.seasonId);
  if (leagues.length === 0) return [];

  const supabase = createServiceClient();
  const { data: cacheRows } = await supabase
    .from('transactions_cache')
    .select('league_id, transactions, week')
    .eq('season_id', status.seasonId)
    .order('week', { ascending: false });

  if (!cacheRows || cacheRows.length === 0) return [];

  const leagueLookup: Record<string, LeagueInfo> = {};
  for (const l of leagues) leagueLookup[l.sleeperId] = l;

  const teamsByLeague = await loadTeamsByLeague(leagues);

  const all: EnrichedTransaction[] = [];
  for (const row of cacheRows) {
    const league = leagueLookup[row.league_id];
    if (!league) continue;
    const txns = row.transactions as SleeperTransaction[] | null;
    if (!Array.isArray(txns)) continue;
    for (const txn of txns) {
      if (txn.status !== 'complete') continue;
      all.push({
        ...txn,
        leagueId: league.sleeperId,
        leagueName: league.name,
        leagueShortName: league.shortName,
        leagueColor: league.color,
        teams: teamsByLeague[league.sleeperId] ?? {},
      });
    }
  }

  all.sort((a, b) => b.created - a.created);
  return all;
}
