import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { isRecapAuthorized } from '@/lib/recap-auth';

/**
 * GET /api/recap/member-profile?memberId=X
 * Career deep dive: all seasons, record, transactions, draft picks, rankings.
 */
export async function GET(req: NextRequest) {
  if (!isRecapAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const memberId = searchParams.get('memberId');

  if (!memberId) {
    return NextResponse.json({ error: 'memberId is required' }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Get member info
  const { data: member } = await supabase
    .from('members')
    .select('id, full_name, display_name, email, status, joined_season, notes')
    .eq('id', memberId)
    .single();

  if (!member) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 });
  }

  // Get all member_seasons (career history)
  const { data: memberSeasons } = await supabase
    .from('member_seasons')
    .select('id, season_id, league_id, sleeper_roster_id, draft_position, seasons(year, status), leagues(name, color, sleeper_league_id)')
    .eq('member_id', memberId)
    .order('created_at', { ascending: false });

  // Aggregate career stats from weekly_results
  const msIds = (memberSeasons ?? []).map((ms) => ms.id);

  let careerWins = 0;
  let careerLosses = 0;
  let careerPoints = 0;
  let careerGames = 0;

  if (msIds.length > 0) {
    const { data: results } = await supabase
      .from('weekly_results')
      .select('points, result')
      .in('member_season_id', msIds)
      .eq('is_bracket', false);

    for (const r of results ?? []) {
      careerGames += 1;
      careerPoints += r.points ?? 0;
      if (r.result === 'win') careerWins += 1;
      if (r.result === 'loss') careerLosses += 1;
    }
  }

  // Get draft picks
  const { data: draftPicks } = await supabase
    .from('draft_picks')
    .select('round, pick_in_round, overall_pick, player_name, position, draft_board_id')
    .in('member_season_id', msIds.length > 0 ? msIds : ['none'])
    .order('overall_pick', { ascending: true });

  return NextResponse.json({
    member: {
      id: member.id,
      fullName: member.full_name,
      displayName: member.display_name,
      status: member.status,
      joinedSeason: member.joined_season,
    },
    seasons: (memberSeasons ?? []).map((ms) => {
      const season = ms.seasons as unknown as { year: string; status: string } | null;
      const league = ms.leagues as unknown as { name: string; color: string } | null;
      return {
        memberSeasonId: ms.id,
        seasonYear: season?.year ?? '',
        seasonStatus: season?.status ?? '',
        leagueName: league?.name ?? '',
        leagueColor: league?.color ?? '',
        draftPosition: ms.draft_position,
      };
    }),
    careerStats: {
      seasons: memberSeasons?.length ?? 0,
      games: careerGames,
      wins: careerWins,
      losses: careerLosses,
      totalPoints: Math.round(careerPoints * 100) / 100,
      avgPointsPerGame: careerGames > 0 ? Math.round((careerPoints / careerGames) * 100) / 100 : 0,
    },
    draftHistory: draftPicks ?? [],
  });
}
