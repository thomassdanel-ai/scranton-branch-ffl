import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { isRecapAuthorized } from '@/lib/recap-auth';

/**
 * GET /api/recap/season-summary?seasonId=X&cohortId=Y
 * End-of-season stats, awards, champion info.
 */
export async function GET(req: NextRequest) {
  if (!isRecapAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const seasonId = searchParams.get('seasonId');
  const cohortId = searchParams.get('cohortId');

  if (!seasonId) {
    return NextResponse.json({ error: 'seasonId is required' }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Season + archive
  const { data: season } = await supabase
    .from('seasons')
    .select('id, year, status')
    .eq('id', seasonId)
    .single();

  if (!season) {
    return NextResponse.json({ error: 'Season not found' }, { status: 404 });
  }

  const { data: archive } = await supabase
    .from('season_archives')
    .select('final_standings, champion, awards')
    .eq('season_id', seasonId)
    .single();

  // Leagues
  let leagueQuery = supabase
    .from('leagues')
    .select('id, name, color, sleeper_league_id')
    .eq('season_id', seasonId);

  if (cohortId) {
    leagueQuery = leagueQuery.eq('cohort_id', cohortId);
  }

  const { data: leagues } = await leagueQuery;
  const leagueIds = (leagues ?? []).map((l) => l.sleeper_league_id).filter(Boolean) as string[];

  // Aggregate season stats from weekly_results
  const { data: allResults } = await supabase
    .from('weekly_results')
    .select('roster_id, league_id, points, result, member_season_id, member_seasons(members(full_name, display_name))')
    .eq('season_id', seasonId)
    .eq('is_bracket', false)
    .in('league_id', leagueIds);

  // Compute per-team aggregates
  const teamStats: Record<string, {
    memberName: string;
    leagueId: string;
    totalPoints: number;
    wins: number;
    losses: number;
    games: number;
  }> = {};

  for (const r of allResults ?? []) {
    const key = `${r.league_id}-${r.roster_id}`;
    if (!teamStats[key]) {
      const ms = r.member_seasons as unknown as { members: { full_name: string; display_name: string | null } } | null;
      teamStats[key] = {
        memberName: ms?.members?.display_name ?? ms?.members?.full_name ?? `Roster ${r.roster_id}`,
        leagueId: r.league_id,
        totalPoints: 0,
        wins: 0,
        losses: 0,
        games: 0,
      };
    }
    teamStats[key].totalPoints += r.points ?? 0;
    teamStats[key].games += 1;
    if (r.result === 'win') teamStats[key].wins += 1;
    if (r.result === 'loss') teamStats[key].losses += 1;
  }

  const teams = Object.values(teamStats);
  const mostPoints = teams.reduce((max, t) => (t.totalPoints > (max?.totalPoints ?? 0) ? t : max), teams[0]);
  const bestRecord = teams.reduce((best, t) => (t.wins > (best?.wins ?? 0) ? t : best), teams[0]);

  // Bracket data
  const { data: bracket } = await supabase
    .from('brackets')
    .select('bracket_data')
    .eq('season_id', seasonId)
    .single();

  return NextResponse.json({
    season: { year: season.year, status: season.status },
    archive: archive ?? null,
    leagueCount: leagues?.length ?? 0,
    teamCount: teams.length,
    seasonStats: {
      mostPoints: mostPoints ? { memberName: mostPoints.memberName, points: mostPoints.totalPoints, leagueId: mostPoints.leagueId } : null,
      bestRecord: bestRecord ? { memberName: bestRecord.memberName, wins: bestRecord.wins, losses: bestRecord.losses, leagueId: bestRecord.leagueId } : null,
    },
    bracket: bracket?.bracket_data ?? null,
  });
}
