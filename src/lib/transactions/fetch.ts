import { getTransactions, getNFLState } from '@/lib/sleeper/api';
import { getLeagueTeams, getLastPlayedWeek } from '@/lib/sleeper/league-data';
import { getSeasonLeagues, type LeagueInfo } from '@/lib/config';
import type { SleeperTransaction } from '@/lib/sleeper/types';
import type { LeagueTeam } from '@/lib/sleeper/league-data';

export type EnrichedTransaction = SleeperTransaction & {
  leagueId: string;
  leagueName: string;
  leagueShortName: string;
  leagueColor: string;
  teams: Record<number, LeagueTeam>;
};

async function getMaxWeek(leagueId: string): Promise<number> {
  const nflState = await getNFLState();

  // During offseason or pre-season, use last played week
  if (nflState.season_type === 'pre' || nflState.week === 0) {
    return getLastPlayedWeek(leagueId);
  }

  return nflState.week;
}

async function fetchLeagueTransactions(
  league: LeagueInfo,
  maxWeek: number,
  teamsForLeague: LeagueTeam[]
): Promise<EnrichedTransaction[]> {
  const teamsByRosterId: Record<number, LeagueTeam> = {};
  for (const team of teamsForLeague) {
    teamsByRosterId[team.rosterId] = team;
  }

  // Fetch all weeks in parallel
  const weekNumbers = Array.from({ length: maxWeek }, (_, i) => i + 1);
  const weekResults = await Promise.all(
    weekNumbers.map((week) =>
      getTransactions(league.sleeperId, week).catch(() => [] as SleeperTransaction[])
    )
  );

  const allTransactions: EnrichedTransaction[] = [];

  for (const weekTxns of weekResults) {
    for (const txn of weekTxns) {
      if (txn.status !== 'complete') continue;
      allTransactions.push({
        ...txn,
        leagueId: league.sleeperId,
        leagueName: league.name,
        leagueShortName: league.shortName,
        leagueColor: league.color,
        teams: teamsByRosterId,
      });
    }
  }

  return allTransactions;
}

export async function getAllTransactions(): Promise<EnrichedTransaction[]> {
  const leagues = await getSeasonLeagues();

  // Fetch max week and teams for each league in parallel
  const leagueData = await Promise.all(
    leagues.map(async (league) => {
      const [maxWeek, teams] = await Promise.all([
        getMaxWeek(league.sleeperId),
        getLeagueTeams(league.sleeperId),
      ]);
      return { league, maxWeek, teams };
    })
  );

  // Fetch all transactions across leagues in parallel
  const results = await Promise.all(
    leagueData.map(({ league, maxWeek, teams }) =>
      fetchLeagueTransactions(league, maxWeek, teams)
    )
  );

  // Flatten and sort newest first
  const all = results.flat();
  all.sort((a, b) => b.created - a.created);

  return all;
}
