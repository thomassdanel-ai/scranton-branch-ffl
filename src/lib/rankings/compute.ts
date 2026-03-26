import { getLeagueTeams } from '@/lib/sleeper/league-data';
import { getMatchups, getNFLState } from '@/lib/sleeper/api';
import { getSeasonLeagues } from '@/lib/config';
import type { LeagueInfo } from '@/lib/config';
import type { LeagueTeam } from '@/lib/sleeper/league-data';

export type RankedTeam = {
  team: LeagueTeam;
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
  const leagues = await getSeasonLeagues();

  // Build a lookup from sleeperId to league info
  const leagueLookup: Record<string, LeagueInfo> = {};
  for (const l of leagues) {
    leagueLookup[l.sleeperId] = l;
  }

  // Gather all teams from all leagues
  const allTeams: { team: LeagueTeam; leagueId: string }[] = [];

  for (const league of leagues) {
    const teams = await getLeagueTeams(league.sleeperId);
    for (const team of teams) {
      allTeams.push({ team, leagueId: league.sleeperId });
    }
  }

  if (!allTeams.length) return [];

  // Compute expected wins for each team across all leagues
  const expectedWinsMap = await computeExpectedWins();

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

/**
 * Compute expected wins for every team.
 * For each week, compare each team's score against every other team's score
 * across ALL leagues. Expected wins = total hypothetical wins / total hypothetical games.
 */
async function computeExpectedWins(): Promise<Map<string, number>> {
  const leagues = await getSeasonLeagues();
  const nflState = await getNFLState();
  const maxWeek = nflState.week > 0
    ? nflState.week
    : await getMaxWeekFromRosters(leagues);

  // Collect all weekly scores: week -> array of { leagueId, rosterId, points }
  const weeklyScores: Array<{ leagueId: string; rosterId: number; points: number }>[] = [];

  for (let week = 1; week <= maxWeek; week++) {
    const weekScores: typeof weeklyScores[0] = [];
    for (const league of leagues) {
      try {
        const matchups = await getMatchups(league.sleeperId, week);
        for (const m of matchups) {
          if (m.points != null && m.points > 0) {
            weekScores.push({
              leagueId: league.sleeperId,
              rosterId: m.roster_id,
              points: m.points,
            });
          }
        }
      } catch {
        // Skip weeks with no data
      }
    }
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

  // Convert to expected win totals (scaled to actual number of games played)
  const expectedWins = new Map<string, number>();
  for (const key of Object.keys(winsRecord)) {
    const totalWins = winsRecord[key];
    const totalGames = gamesRecord[key] ?? 1;
    const winRate = totalWins / totalGames;
    expectedWins.set(key, winRate * maxWeek);
  }

  return expectedWins;
}

async function getMaxWeekFromRosters(leagues: LeagueInfo[]): Promise<number> {
  for (const league of leagues) {
    try {
      const { getLeagueRosters } = await import('@/lib/sleeper/api');
      const rosters = await getLeagueRosters(league.sleeperId);
      if (rosters.length) {
        return Math.max(...rosters.map((r) => r.settings.wins + r.settings.losses + r.settings.ties));
      }
    } catch {
      continue;
    }
  }
  return 1;
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
