import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { isRecapAuthorized } from '@/lib/recap-auth';

/**
 * GET /api/recap/weekly?seasonId=X&week=N&cohortId=Y
 * Returns comprehensive weekly data for AI-generated recaps.
 */
export async function GET(req: NextRequest) {
  if (!isRecapAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const seasonId = searchParams.get('seasonId');
  const weekStr = searchParams.get('week');
  const cohortId = searchParams.get('cohortId');

  if (!seasonId || !weekStr) {
    return NextResponse.json({ error: 'seasonId and week are required' }, { status: 400 });
  }

  const week = parseInt(weekStr, 10);
  if (isNaN(week) || week < 1 || week > 18) {
    return NextResponse.json({ error: 'Invalid week' }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Get season info
  const { data: season } = await supabase
    .from('seasons')
    .select('id, year, status')
    .eq('id', seasonId)
    .single();

  if (!season) {
    return NextResponse.json({ error: 'Season not found' }, { status: 404 });
  }

  // Get leagues (optionally filtered by cohort)
  let leagueQuery = supabase
    .from('leagues')
    .select('id, name, color, short_name, sleeper_league_id, cohort_id')
    .eq('season_id', seasonId);

  if (cohortId) {
    leagueQuery = leagueQuery.eq('cohort_id', cohortId);
  }

  const { data: leagues } = await leagueQuery;
  if (!leagues || leagues.length === 0) {
    return NextResponse.json({ error: 'No leagues found' }, { status: 404 });
  }

  const leagueIds = leagues.map((l) => l.sleeper_league_id).filter(Boolean) as string[];

  // Get weekly results with member identity
  const { data: results } = await supabase
    .from('weekly_results')
    .select('*, member_seasons(id, members(full_name, display_name))')
    .eq('season_id', seasonId)
    .eq('week', week)
    .in('league_id', leagueIds);

  // Build matchups
  const matchupGroups: Record<string, Record<number, typeof results>> = {};
  for (const r of results ?? []) {
    const key = `${r.league_id}-${r.matchup_id}`;
    if (!matchupGroups[key]) matchupGroups[key] = {};
    matchupGroups[key][r.roster_id] = [r];
  }

  const leagueMap = new Map(leagues.map((l) => [l.sleeper_league_id, l]));

  const matchups = Object.entries(matchupGroups).map(([, sides]) => {
    const teams = Object.values(sides).flat();
    if (teams.length < 2) return null;

    const [t1, t2] = teams;
    const league = leagueMap.get(t1.league_id);
    const ms1 = t1.member_seasons as { members: { full_name: string; display_name: string | null } } | null;
    const ms2 = t2.member_seasons as { members: { full_name: string; display_name: string | null } } | null;

    return {
      league: { name: league?.name ?? '', color: league?.color ?? '' },
      team1: {
        memberName: ms1?.members?.display_name ?? ms1?.members?.full_name ?? `Roster ${t1.roster_id}`,
        points: t1.points,
        record: `${t1.season_wins}-${t1.season_losses}`,
        streak: t1.streak,
      },
      team2: {
        memberName: ms2?.members?.display_name ?? ms2?.members?.full_name ?? `Roster ${t2.roster_id}`,
        points: t2.points,
        record: `${t2.season_wins}-${t2.season_losses}`,
        streak: t2.streak,
      },
      margin: Math.abs((t1.points ?? 0) - (t2.points ?? 0)),
    };
  }).filter(Boolean);

  // Get power rankings for this week
  const { data: rankingsRow } = await supabase
    .from('power_rankings')
    .select('rankings')
    .eq('season_id', seasonId)
    .eq('week', week)
    .single();

  // Get transactions
  const { data: txRows } = await supabase
    .from('transactions_cache')
    .select('transactions, league_id')
    .eq('season_id', seasonId)
    .eq('week', week)
    .in('league_id', leagueIds);

  // Notable stats
  const allResults = results ?? [];
  const highestScore = allResults.reduce((max, r) => (r.points > (max?.points ?? 0) ? r : max), allResults[0]);
  const lowestScore = allResults.reduce((min, r) => (r.points < (min?.points ?? Infinity) ? r : min), allResults[0]);
  const closestGame = matchups.reduce((closest, m) => {
    if (!m || !closest) return closest ?? m;
    return m!.margin < closest.margin ? m : closest;
  }, matchups[0]);

  // Get player scores for notable performances
  const { data: playerScores } = await supabase
    .from('player_weekly_scores')
    .select('player_id, roster_id, points, is_starter, member_season_id')
    .eq('season_id', seasonId)
    .eq('week', week)
    .in('league_id', leagueIds)
    .order('points', { ascending: false })
    .limit(50);

  const bestBench = playerScores?.find((p) => !p.is_starter);

  return NextResponse.json({
    season: { year: season.year, weekNumber: week, status: season.status },
    matchups,
    powerRankings: rankingsRow?.rankings ?? [],
    transactions: txRows?.flatMap((t) => {
      const txList = t.transactions as Array<Record<string, unknown>>;
      return txList.map((tx) => ({ ...tx, league_id: t.league_id }));
    }) ?? [],
    notableStats: {
      highestScore: highestScore ? { rosterId: highestScore.roster_id, points: highestScore.points, leagueId: highestScore.league_id } : null,
      lowestScore: lowestScore ? { rosterId: lowestScore.roster_id, points: lowestScore.points, leagueId: lowestScore.league_id } : null,
      closestGame,
      bestBenchPlayer: bestBench ? { playerId: bestBench.player_id, points: bestBench.points, rosterId: bestBench.roster_id } : null,
    },
  });
}
