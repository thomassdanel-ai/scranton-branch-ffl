import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAuth, AuthError } from '@/lib/auth';

/**
 * POST: Backfill member_season_id on weekly_results and player_weekly_scores
 * for rows where it is NULL. Resolves via league_id + roster_id → member_seasons.
 */
export async function POST(req: NextRequest) {
  try {
    await requireAuth();

    const supabase = createServiceClient();
    let updatedResults = 0;
    let updatedScores = 0;

    // Get all leagues with sleeper mappings
    const { data: leagues } = await supabase
      .from('leagues')
      .select('id, sleeper_league_id, season_id');

    if (!leagues) {
      return NextResponse.json({ error: 'No leagues found' }, { status: 400 });
    }

    for (const league of leagues) {
      if (!league.sleeper_league_id) continue;

      // Get member_seasons for this league
      const { data: memberSeasons } = await supabase
        .from('member_seasons')
        .select('id, sleeper_roster_id')
        .eq('league_id', league.id);

      if (!memberSeasons || memberSeasons.length === 0) continue;

      // Build roster_id → member_season_id map
      for (const ms of memberSeasons) {
        if (!ms.sleeper_roster_id) continue;
        const rosterId = Number(ms.sleeper_roster_id);

        // Update weekly_results
        const { data: wrData } = await supabase
          .from('weekly_results')
          .update({ member_season_id: ms.id })
          .eq('league_id', league.sleeper_league_id)
          .eq('roster_id', rosterId)
          .eq('season_id', league.season_id)
          .is('member_season_id', null)
          .select('id');

        updatedResults += wrData?.length ?? 0;

        // Update player_weekly_scores
        const { data: psData } = await supabase
          .from('player_weekly_scores')
          .update({ member_season_id: ms.id })
          .eq('league_id', league.sleeper_league_id)
          .eq('roster_id', rosterId)
          .eq('season_id', league.season_id)
          .is('member_season_id', null)
          .select('id');

        updatedScores += psData?.length ?? 0;
      }
    }

    return NextResponse.json({
      ok: true,
      updatedResults,
      updatedScores,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
