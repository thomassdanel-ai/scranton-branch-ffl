import { NextRequest, NextResponse } from 'next/server';
import { LEAGUE_CONFIG } from '@/config/leagues';
import { getLeague, getLeagueRosters, getMatchups } from '@/lib/sleeper/api';
import { createServiceClient } from '@/lib/supabase/server';
import { isAuthed } from '@/lib/auth';
import { buildWeeklyResults, buildPlayerScores } from '@/lib/weekly-results';

// POST: Backfill weekly results for all leagues, all weeks played
export async function POST(req: NextRequest) {
  if (!isAuthed()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { seasonId, maxWeek } = body as { seasonId?: string; maxWeek?: number };

  const supabase = createServiceClient();

  // Find the season ID if not provided
  let sId: string = seasonId || '';
  if (!sId) {
    // Try status-based lookup first (any in-progress season)
    const { data: byStatus } = await supabase
      .from('seasons')
      .select('id')
      .in('status', ['active', 'drafting', 'pre_draft', 'setup'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (byStatus) {
      sId = byStatus.id;
    } else {
      // Fallback: old is_current boolean
      const { data: byCurrent } = await supabase
        .from('seasons')
        .select('id')
        .eq('is_current', true)
        .limit(1)
        .single();
      if (!byCurrent) {
        return NextResponse.json({ error: 'No current season found' }, { status: 400 });
      }
      sId = byCurrent.id;
    }
  }

  // Determine max week from rosters if not provided
  let weeksToFetch = maxWeek;
  if (!weeksToFetch) {
    const rosters = await getLeagueRosters(LEAGUE_CONFIG.leagues[0].id);
    if (rosters.length > 0) {
      weeksToFetch = Math.max(
        ...rosters.map((r) => r.settings.wins + r.settings.losses + r.settings.ties)
      );
    }
    if (!weeksToFetch || weeksToFetch < 1) weeksToFetch = 1;
  }

  const summary: Record<string, { weeks: number; rows: number }> = {};

  let totalPlayerRows = 0;

  for (const league of LEAGUE_CONFIG.leagues) {
    let totalRows = 0;
    const [rosters, leagueData] = await Promise.all([
      getLeagueRosters(league.id),
      getLeague(league.id),
    ]);
    const rosterPositions = leagueData.roster_positions.filter(
      (pos) => pos !== 'BN' && pos !== 'IR'
    );

    for (let week = 1; week <= weeksToFetch; week++) {
      try {
        const matchups = await getMatchups(league.id, week);
        if (!matchups.length) continue;

        const weeklyRows = buildWeeklyResults(sId, league.id, week, matchups, rosters);
        if (weeklyRows.length > 0) {
          const { error } = await supabase
            .from('weekly_results')
            .upsert(weeklyRows, { onConflict: 'league_id,week,roster_id' });
          if (error) {
            console.error(`Backfill failed ${league.name} week ${week}:`, error.message);
          } else {
            totalRows += weeklyRows.length;
          }
        }

        // Also save per-player scores (starters + bench)
        const playerRows = buildPlayerScores(sId, league.id, week, matchups, rosterPositions);
        if (playerRows.length > 0) {
          const { error } = await supabase
            .from('player_weekly_scores')
            .upsert(playerRows, { onConflict: 'league_id,week,roster_id,player_id' });
          if (!error) totalPlayerRows += playerRows.length;
        }
      } catch {
        // Skip weeks with no data (e.g., future weeks)
      }
    }

    summary[league.name] = { weeks: weeksToFetch, rows: totalRows };
  }

  // Also backfill bracket results if a bracket exists
  const { data: bracket } = await supabase
    .from('brackets')
    .select('bracket_data')
    .order('updated_at', { ascending: false })
    .limit(1)
    .single();

  let bracketRows = 0;
  if (bracket?.bracket_data) {
    const bd = bracket.bracket_data as {
      matchups: Array<{
        id: string;
        round: number;
        team1Seed: number | null;
        team2Seed: number | null;
        team1Score: number | null;
        team2Score: number | null;
        winningSeed: number | null;
      }>;
      teams: Array<{
        seed: number;
        rosterId: number;
        leagueId: string;
      }>;
      playoffStartWeek?: number;
    };

    const startWeek = bd.playoffStartWeek || (weeksToFetch + 1);

    for (const matchup of bd.matchups) {
      if (matchup.team1Score == null || matchup.team2Score == null) continue;
      if (matchup.team1Seed == null || matchup.team2Seed == null) continue;

      const team1 = bd.teams.find((t) => t.seed === matchup.team1Seed);
      const team2 = bd.teams.find((t) => t.seed === matchup.team2Seed);
      if (!team1 || !team2) continue;

      const bracketWeek = startWeek + matchup.round - 1;

      const rows = [
        {
          season_id: sId,
          league_id: team1.leagueId,
          week: bracketWeek,
          roster_id: team1.rosterId,
          points: matchup.team1Score,
          opponent_roster_id: team2.rosterId,
          opponent_points: matchup.team2Score,
          result: matchup.team1Score > matchup.team2Score ? 'win' : matchup.team1Score < matchup.team2Score ? 'loss' : 'tie',
          matchup_id: null,
          season_wins: 0,
          season_losses: 0,
          season_ties: 0,
          season_points_for: 0,
          season_points_against: 0,
          streak: null,
          is_playoff: true,
          is_bracket: true,
          bracket_round: matchup.id,
          fetched_at: new Date().toISOString(),
        },
        {
          season_id: sId,
          league_id: team2.leagueId,
          week: bracketWeek,
          roster_id: team2.rosterId,
          points: matchup.team2Score,
          opponent_roster_id: team1.rosterId,
          opponent_points: matchup.team1Score,
          result: matchup.team2Score > matchup.team1Score ? 'win' : matchup.team2Score < matchup.team1Score ? 'loss' : 'tie',
          matchup_id: null,
          season_wins: 0,
          season_losses: 0,
          season_ties: 0,
          season_points_for: 0,
          season_points_against: 0,
          streak: null,
          is_playoff: true,
          is_bracket: true,
          bracket_round: matchup.id,
          fetched_at: new Date().toISOString(),
        },
      ];

      const { error } = await supabase
        .from('weekly_results')
        .upsert(rows, { onConflict: 'league_id,week,roster_id' });
      if (!error) bracketRows += rows.length;
    }
  }

  return NextResponse.json({
    ok: true,
    seasonId: sId,
    weeksBackfilled: weeksToFetch,
    leagues: summary,
    bracketResults: bracketRows,
    playerScores: totalPlayerRows,
  });
}
