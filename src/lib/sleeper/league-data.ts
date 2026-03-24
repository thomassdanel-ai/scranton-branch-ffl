import { getLeagueUsers, getLeagueRosters, getMatchups, getLeague, getNFLState, getAvatarUrl } from './api';
import { LEAGUE_CONFIG } from '@/config/leagues';
import type { SleeperRoster, SleeperUser } from './types';

export type LeagueTeam = {
  rosterId: number;
  userId: string;
  username: string;
  displayName: string;
  teamName: string | null;
  avatar: string | null;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  streak: string | null;
  waiverPosition: number;
  totalMoves: number;
};

export type MatchupSide = {
  team: LeagueTeam;
  points: number;
  starters: string[];
  startersPoints: number[];
};

export type MatchupPair = {
  matchupId: number;
  team1: MatchupSide;
  team2: MatchupSide;
};

export type StandingsTeam = LeagueTeam & {
  rank: number;
  inPlayoffPosition: boolean;
};

export function findLeagueConfig(leagueId: string) {
  return LEAGUE_CONFIG.leagues.find((l) => l.id === leagueId) ?? null;
}

function mergeTeam(roster: SleeperRoster, user: SleeperUser | undefined): LeagueTeam {
  return {
    rosterId: roster.roster_id,
    userId: roster.owner_id ?? '',
    username: user?.username ?? 'Unknown',
    displayName: user?.display_name ?? user?.username ?? 'Unknown',
    teamName: user?.metadata?.team_name ?? null,
    avatar: getAvatarUrl(user?.avatar ?? null, true),
    wins: roster.settings.wins,
    losses: roster.settings.losses,
    ties: roster.settings.ties,
    pointsFor: roster.settings.fpts + (roster.settings.fpts_decimal ?? 0) / 100,
    pointsAgainst: roster.settings.fpts_against + (roster.settings.fpts_against_decimal ?? 0) / 100,
    streak: roster.metadata?.streak ?? null,
    waiverPosition: roster.settings.waiver_position,
    totalMoves: roster.settings.total_moves,
  };
}

export async function getLeagueTeams(leagueId: string): Promise<LeagueTeam[]> {
  const [users, rosters] = await Promise.all([
    getLeagueUsers(leagueId),
    getLeagueRosters(leagueId),
  ]);

  const userMap = new Map(users.map((u) => [u.user_id, u]));

  return rosters.map((roster) => mergeTeam(roster, userMap.get(roster.owner_id)));
}

export async function getLeagueStandings(leagueId: string): Promise<StandingsTeam[]> {
  const teams = await getLeagueTeams(leagueId);
  const qualifiers = LEAGUE_CONFIG.championship.qualifiersPerLeague;

  const sorted = teams.sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    return b.pointsFor - a.pointsFor;
  });

  return sorted.map((team, i) => ({
    ...team,
    rank: i + 1,
    inPlayoffPosition: i < qualifiers,
  }));
}

export async function getWeekMatchups(leagueId: string, week: number): Promise<MatchupPair[]> {
  const [matchups, teams] = await Promise.all([
    getMatchups(leagueId, week),
    getLeagueTeams(leagueId),
  ]);

  if (!matchups.length) return [];

  const teamMap = new Map(teams.map((t) => [t.rosterId, t]));
  const grouped = new Map<number, typeof matchups>();

  for (const m of matchups) {
    if (!m.matchup_id) continue;
    const group = grouped.get(m.matchup_id) ?? [];
    group.push(m);
    grouped.set(m.matchup_id, group);
  }

  const pairs: MatchupPair[] = [];

  for (const [matchupId, sides] of grouped) {
    if (sides.length < 2) continue;
    const [a, b] = sides;
    const teamA = teamMap.get(a.roster_id);
    const teamB = teamMap.get(b.roster_id);
    if (!teamA || !teamB) continue;

    pairs.push({
      matchupId,
      team1: {
        team: teamA,
        points: a.points ?? 0,
        starters: a.starters ?? [],
        startersPoints: a.starters_points ?? [],
      },
      team2: {
        team: teamB,
        points: b.points ?? 0,
        starters: b.starters ?? [],
        startersPoints: b.starters_points ?? [],
      },
    });
  }

  return pairs;
}

export async function getLastPlayedWeek(leagueId: string): Promise<number> {
  const rosters = await getLeagueRosters(leagueId);
  if (!rosters.length) return 1;
  const maxGames = Math.max(
    ...rosters.map((r) => r.settings.wins + r.settings.losses + r.settings.ties)
  );
  return maxGames || 1;
}

export async function getLeagueRosterPositions(leagueId: string): Promise<string[]> {
  const league = await getLeague(leagueId);
  return league.roster_positions.filter(
    (pos) => pos !== 'BN' && pos !== 'IR'
  );
}
