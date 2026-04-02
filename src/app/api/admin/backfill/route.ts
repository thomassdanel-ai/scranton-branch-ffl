import { NextRequest, NextResponse } from 'next/server';
import { getLeague, getLeagueRosters, getMatchups, getTransactions } from '@/lib/sleeper/api';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAuth, AuthError } from '@/lib/auth';
import { buildWeeklyResults, buildPlayerScores } from '@/lib/weekly-results';
import { getSeasonLeagues, getActiveSeasonId } from '@/lib/config';
import { computePowerRankings } from '@/lib/rankings/compute';

// POST: Backfill weekly results for all leagues, all weeks played
export async function POST(req: NextRequest) {
  try {
    await requireAuth();

    const body = await req.json();
  const { seasonId, maxWeek } = body as { seasonId?: string; maxWeek?: number };

  const supabase = createServiceClient();

  let sId: string = seasonId || '';
  if (!sId) {
    const activeId = await getActiveSeasonId();
    if (!activeId) {
      // Fall back to most recent season (for off-season backfill)
      const { data: latest } = await supabase
        .from('seasons')
        .select('id')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      if (!latest?.id) {
        return NextResponse.json({ error: 'No season found' }, { status: 400 });
      }
      sId = latest.id;
    } else {
      sId = activeId;
    }
  }

  const leagues = await getSeasonLeagues(sId);
  if (!leagues.length) {
    return NextResponse.json({ error: 'No leagues found for this season' }, { status: 400 });
  }

  // Determine max week from rosters if not provided
  let weeksToFetch = maxWeek;
  if (!weeksToFetch) {
    const rosters = await getLeagueRosters(leagues[0].sleeperId);
    if (rosters.length > 0) {
      weeksToFetch = Math.max(
        ...rosters.map((r) => r.settings.wins + r.settings.losses + r.settings.ties)
      );
    }
    if (!weeksToFetch || weeksToFetch < 1) weeksToFetch = 1;
  }

  const summary: Record<string, { weeks: number; rows: number }> = {};
  let totalPlayerRows = 0;

  for (const league of leagues) {
    let totalRows = 0;
    const [rosters, leagueData] = await Promise.all([
      getLeagueRosters(league.sleeperId),
      getLeague(league.sleeperId),
    ]);
    const rosterPositions = leagueData.roster_positions.filter(
      (pos) => pos !== 'BN' && pos !== 'IR'
    );

    for (let week = 1; week <= weeksToFetch; week++) {
      try {
        const matchups = await getMatchups(league.sleeperId, week);
        if (!matchups.length) continue;

        const weeklyRows = buildWeeklyResults(sId, league.sleeperId, week, matchups, rosters);
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

        const playerRows = buildPlayerScores(sId, league.sleeperId, week, matchups, rosterPositions);
        if (playerRows.length > 0) {
          const { error } = await supabase
            .from('player_weekly_scores')
            .upsert(playerRows, { onConflict: 'league_id,week,roster_id,player_id' });
          if (!error) totalPlayerRows += playerRows.length;
        }
      } catch {
        // Skip weeks with no data
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

  // Backfill transactions cache
  let transactionRows = 0;
  for (const league of leagues) {
    for (let week = 1; week <= weeksToFetch!; week++) {
      try {
        const txns = await getTransactions(league.sleeperId, week);
        if (txns.length > 0) {
          const { error } = await supabase
            .from('transactions_cache')
            .upsert(
              {
                season_id: sId,
                league_id: league.sleeperId,
                week,
                transactions: txns,
                fetched_at: new Date().toISOString(),
              },
              { onConflict: 'league_id,week' }
            );
          if (!error) transactionRows += txns.length;
        }
      } catch {
        // Skip weeks with no data
      }
    }
  }

  // Backfill power rankings (final week snapshot)
  let rankingsBackfilled = false;
  try {
    const rankings = await computePowerRankings();
    if (rankings.length > 0) {
      const { error } = await supabase
        .from('power_rankings')
        .upsert(
          {
            season_id: sId,
            week: weeksToFetch,
            rankings,
            computed_at: new Date().toISOString(),
          },
          { onConflict: 'season_id,week' }
        );
      rankingsBackfilled = !error;
    }
  } catch (err) {
    console.error('Power rankings backfill failed:', err);
  }

    return NextResponse.json({
      ok: true,
      seasonId: sId,
      weeksBackfilled: weeksToFetch,
      leagues: summary,
      bracketResults: bracketRows,
      playerScores: totalPlayerRows,
      transactionsBackfilled: transactionRows,
      rankingsBackfilled,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
