import { getSeasonLeagues, getSeasonStatus, getActiveSeasonId } from '@/lib/config';
import { createServiceClient } from '@/lib/supabase/server';
import type { LeagueInfo } from '@/lib/config';

type TeamRecord = {
  rosterId: number;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  streak: string | null;
  displayName: string;
  teamName?: string;
  avatar?: string;
};

export type RankedTeam = {
  team: TeamRecord;
  leagueId: string;
  leagueName: string;
  leagueColor: string;
  powerScore: number;
  winPctScore: number;
  pointsForScore: number;
  luckScore: number;
  streakScore: number;
  expectedWins: number;
  rank: number;
};

/**
 * Load cached power rankings from the DB for the most recent week.
 * Used during off-season when live Sleeper data may not be meaningful.
 */
async function getCachedRankings(seasonId: string): Promise<RankedTeam[]> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('power_rankings')
    .select('rankings')
    .eq('season_id', seasonId)
    .order('week', { ascending: false })
    .limit(1)
    .single();

  if (!data?.rankings) return [];
  return data.rankings as RankedTeam[];
}

/**
 * Cross-league Power Rankings
 *
 * Power Score = (Win% × 40) + (PF Percentile × 35) + (Luck × 15) + (Streak × 10)
 *
 * - Win%: straightforward win percentage (0–1 scaled to 0–40)
 * - PF Percentile: rank by total points scored across all 20 teams (0–1 scaled to 0–35)
 * - Luck: compares actual wins to expected wins if you played every team every week (0–1 scaled to 0–15)
 * - Streak: current streak normalized (-1 to 1 scaled to 0–10)
 */
export async function computePowerRankings(): Promise<RankedTeam[]> {
  // During off-season, return cached rankings from DB
  const status = await getSeasonStatus();
  if (status.isOffSeason && status.seasonId) {
    const cached = await getCachedRankings(status.seasonId);
    if (cached.length > 0) return cached;
  }

  const seasonId = await getActiveSeasonId();
  if (!seasonId) return [];

  const leagues = await getSeasonLeagues(seasonId);

  // Build a lookup from sleeperId to league info
  const leagueLookup: Record<string, LeagueInfo> = {};
  for (const l of leagues) {
    leagueLookup[l.sleeperId] = l;
  }

  // Get all teams from weekly_results for this season
  const allTeams = await getAllTeamsFromDatabase(seasonId, leagues);

  if (!allTeams.length) return [];

  // Compute expected wins for each team across all leagues
  const expectedWinsMap = await computeExpectedWins(seasonId);

  // Sort by PF to get percentile ranks
  const sortedByPF = [...allTeams].sort((a, b) => b.team.pointsFor - a.team.pointsFor);
  const pfRankMap = new Map<string, number>();
  sortedByPF.forEach((entry, i) => {
    pfRankMap.set(`${entry.leagueId}-${entry.team.rosterId}`, i);
  });

  const totalTeams = allTeams.length;

  const ranked: RankedTeam[] = allTeams.map((entry) => {
    const { team, leagueId } = entry;
    const leagueConfig = leagueLookup[leagueId];
    const key = `${leagueId}-${team.rosterId}`;

    const totalGames = team.wins + team.losses + team.ties;
    const winPct = totalGames > 0 ? team.wins / totalGames : 0;

    // PF percentile (0 = worst, 1 = best)
    const pfRank = pfRankMap.get(key) ?? totalTeams - 1;
    const pfPercentile = totalTeams > 1 ? 1 - pfRank / (totalTeams - 1) : 0.5;

    // Luck: compare actual wins to expected wins
    const expectedWins = expectedWinsMap.get(key) ?? team.wins;
    const expectedWinPct = totalGames > 0 ? expectedWins / totalGames : 0;
    // Luck is how much better you did than expected, normalized to 0–1 range
    const luckRaw = winPct - expectedWinPct; // -1 to 1
    const luck = (luckRaw + 1) / 2; // normalize to 0–1

    // Streak score: parse streak like "3W" or "5L"
    const streakScore = parseStreakScore(team.streak);

    // Weighted composite
    const winPctScore = winPct * 40;
    const pointsForScore = pfPercentile * 35;
    const luckScoreWeighted = luck * 15;
    const streakScoreWeighted = streakScore * 10;
    const powerScore = winPctScore + pointsForScore + luckScoreWeighted + streakScoreWeighted;

    return {
      team,
      leagueId,
      leagueName: leagueConfig?.name ?? 'Unknown',
      leagueColor: leagueConfig?.color ?? '#6b7280',
      powerScore,
      winPctScore,
      pointsForScore,
      luckScore: luckScoreWeighted,
      streakScore: streakScoreWeighted,
      expectedWins,
      rank: 0,
    };
  });

  // Sort by power score descending
  ranked.sort((a, b) => b.powerScore - a.powerScore);
  ranked.forEach((r, i) => (r.rank = i + 1));

  return ranked;
}

type MemberIdentity = {
  fullName: string | null;
  displayName: string | null;
  sleeperDisplayName: string | null;
};

/**
 * Build identity lookups for every member_season tied to the given leagues.
 *
 * Returns two maps so callers can resolve a result row whether or not it has
 * member_season_id populated (older rows pre-migration 011 may not):
 *   1. byId            — member_seasons.id  -> identity
 *   2. byLeagueRoster  — `${leagues.id}-${sleeper_roster_id}` -> identity
 */
async function loadMemberIdentities(leagues: LeagueInfo[]): Promise<{
  byId: Map<string, MemberIdentity>;
  byLeagueRoster: Map<string, MemberIdentity>;
  dbLeagueIdBySleeper: Map<string, string>;
}> {
  const byId = new Map<string, MemberIdentity>();
  const byLeagueRoster = new Map<string, MemberIdentity>();
  const dbLeagueIdBySleeper = new Map<string, string>();

  for (const l of leagues) {
    if (l.sleeperId && l.dbId) dbLeagueIdBySleeper.set(l.sleeperId, l.dbId);
  }
  if (dbLeagueIdBySleeper.size === 0) {
    return { byId, byLeagueRoster, dbLeagueIdBySleeper };
  }

  const supabase = createServiceClient();
  const { data: rows } = await supabase
    .from('member_seasons')
    .select('id, league_id, sleeper_roster_id, sleeper_display_name, members(full_name, display_name)')
    .in('league_id', Array.from(dbLeagueIdBySleeper.values()));

  if (!rows) return { byId, byLeagueRoster, dbLeagueIdBySleeper };

  for (const row of rows) {
    const member = row.members as unknown as
      | { full_name?: string | null; display_name?: string | null }
      | null;
    const identity: MemberIdentity = {
      fullName: member?.full_name ?? null,
      displayName: member?.display_name ?? null,
      sleeperDisplayName: row.sleeper_display_name ?? null,
    };
    byId.set(row.id, identity);
    if (row.sleeper_roster_id && row.league_id) {
      byLeagueRoster.set(`${row.league_id}-${row.sleeper_roster_id}`, identity);
    }
  }

  return { byId, byLeagueRoster, dbLeagueIdBySleeper };
}

export function resolveTeamDisplay(
  identity: MemberIdentity | undefined,
  rosterId: number,
): { displayName: string; teamName?: string } {
  // PowerRankingsTable renders `team.teamName ?? team.displayName`, so the
  // friendliest name belongs in displayName and teamName stays undefined
  // unless we have an additional Sleeper-team-name string to surface.
  const displayName =
    identity?.displayName ||
    identity?.fullName ||
    identity?.sleeperDisplayName ||
    `Team ${rosterId}`;

  return { displayName };
}

/**
 * Get all teams from weekly_results for the current season.
 * Uses the latest week per league to get current standings, and resolves
 * each row to a real member identity via member_seasons -> members.
 *
 * Historical rows where weekly_results.member_season_id is null are
 * resolved through (league_id, sleeper_roster_id, season_id).
 */
async function getAllTeamsFromDatabase(
  seasonId: string,
  leagues: LeagueInfo[],
): Promise<{ team: TeamRecord; leagueId: string }[]> {
  const supabase = createServiceClient();

  const { data: allResults } = await supabase
    .from('weekly_results')
    .select('league_id, roster_id, week, season_wins, season_losses, season_ties, season_points_for, season_points_against, streak, member_season_id')
    .eq('season_id', seasonId);

  if (!allResults || allResults.length === 0) return [];

  const teamLatestWeek: Record<string, typeof allResults[0]> = {};
  for (const result of allResults) {
    const key = `${result.league_id}-${result.roster_id}`;
    const existing = teamLatestWeek[key];
    if (!existing || result.week > existing.week) {
      teamLatestWeek[key] = result;
    }
  }

  const { byId, byLeagueRoster, dbLeagueIdBySleeper } = await loadMemberIdentities(leagues);

  const resolveIdentity = (
    memberSeasonId: string | null | undefined,
    sleeperLeagueId: string,
    rosterId: number,
  ): MemberIdentity | undefined => {
    if (memberSeasonId) {
      const direct = byId.get(memberSeasonId);
      if (direct) return direct;
    }
    const dbLeagueId = dbLeagueIdBySleeper.get(sleeperLeagueId);
    if (!dbLeagueId) return undefined;
    return byLeagueRoster.get(`${dbLeagueId}-${String(rosterId)}`);
  };

  const allTeams: { team: TeamRecord; leagueId: string }[] = [];

  for (const league of leagues) {
    const leagueTeams = Object.values(teamLatestWeek).filter(
      (r) => r.league_id === league.sleeperId,
    );

    for (const teamData of leagueTeams) {
      const identity = resolveIdentity(
        teamData.member_season_id,
        league.sleeperId,
        teamData.roster_id,
      );
      const { displayName, teamName } = resolveTeamDisplay(identity, teamData.roster_id);

      allTeams.push({
        team: {
          rosterId: teamData.roster_id,
          wins: teamData.season_wins || 0,
          losses: teamData.season_losses || 0,
          ties: teamData.season_ties || 0,
          pointsFor: parseFloat(String(teamData.season_points_for)) || 0,
          pointsAgainst: parseFloat(String(teamData.season_points_against)) || 0,
          streak: teamData.streak,
          displayName,
          teamName,
        },
        leagueId: league.sleeperId,
      });
    }
  }

  return allTeams;
}

/**
 * Compute expected wins for every team using data from weekly_results.
 * For each week, compare each team's score against every other team's score
 * across ALL leagues. Expected wins = total hypothetical wins / total hypothetical games.
 */
async function computeExpectedWins(seasonId: string): Promise<Map<string, number>> {
  const supabase = createServiceClient();

  // Get all weekly results for the season
  const { data: allResults } = await supabase
    .from('weekly_results')
    .select('league_id, roster_id, week, points')
    .eq('season_id', seasonId)
    .order('week', { ascending: true });

  if (!allResults || allResults.length === 0) {
    return new Map();
  }

  // Find max week
  const maxWeek = Math.max(...allResults.map((r) => r.week || 0));

  // Collect weekly scores: week -> array of { leagueId, rosterId, points }
  const weeklyScores: Array<{ leagueId: string; rosterId: number; points: number }>[] = [];

  for (let week = 1; week <= maxWeek; week++) {
    const weekScores = allResults
      .filter((r) => r.week === week && r.points != null && r.points > 0)
      .map((r) => ({
        leagueId: r.league_id,
        rosterId: r.roster_id,
        points: r.points,
      }));

    if (weekScores.length > 0) {
      weeklyScores.push(weekScores);
    }
  }

  // For each team, count how many hypothetical games they'd win
  const winsRecord: Record<string, number> = {};
  const gamesRecord: Record<string, number> = {};

  for (const weekScores of weeklyScores) {
    for (const entry of weekScores) {
      const key = `${entry.leagueId}-${entry.rosterId}`;
      let wins = 0;
      let games = 0;
      for (const opponent of weekScores) {
        if (opponent.leagueId === entry.leagueId && opponent.rosterId === entry.rosterId) continue;
        games++;
        if (entry.points > opponent.points) wins++;
        else if (entry.points === opponent.points) wins += 0.5;
      }
      winsRecord[key] = (winsRecord[key] ?? 0) + wins;
      gamesRecord[key] = (gamesRecord[key] ?? 0) + games;
    }
  }

  // Convert to expected win totals (scaled to actual number of weeks played)
  const expectedWins = new Map<string, number>();
  for (const key of Object.keys(winsRecord)) {
    const totalWins = winsRecord[key];
    const totalGames = gamesRecord[key] ?? 1;
    const winRate = totalWins / totalGames;
    expectedWins.set(key, winRate * maxWeek);
  }

  return expectedWins;
}

function parseStreakScore(streak: string | null): number {
  if (!streak) return 0.5;
  const match = streak.match(/(\d+)(W|L)/i);
  if (!match) return 0.5;
  const count = parseInt(match[1], 10);
  const isWin = match[2].toUpperCase() === 'W';
  // Cap at 5 for normalization, scale to 0–1
  const capped = Math.min(count, 5);
  const raw = isWin ? capped / 5 : -capped / 5; // -1 to 1
  return (raw + 1) / 2; // normalize to 0–1
}
