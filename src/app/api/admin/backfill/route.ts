import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { LEAGUE_CONFIG } from '@/config/leagues';
import { getLeagueRosters, getMatchups } from '@/lib/sleeper/api';
import { createServiceClient } from '@/lib/supabase/server';
import type { SleeperMatchup, SleeperRoster } from '@/lib/sleeper/types';

function isAuthed(): boolean {
  const cookieStore = cookies();
  return cookieStore.get('admin_auth')?.value === 'true';
}

function buildWeeklyResults(
  seasonId: string,
  leagueId: string,
  week: number,
  matchups: SleeperMatchup[],
  rosters: SleeperRoster[]
) {
  const grouped: Record<number, SleeperMatchup[]> = {};
  for (const m of matchups) {
    if (!m.matchup_id) continue;
    if (!grouped[m.matchup_id]) grouped[m.matchup_id] = [];
    grouped[m.matchup_id].push(m);
  }

  const rosterMap: Record<number, SleeperRoster> = {};
  for (const r of rosters) {
    rosterMap[r.roster_id] = r;
  }

  const rows: Array<Record<string, unknown>> = [];

  for (const matchupId of Object.keys(grouped)) {
    const sides = grouped[Number(matchupId)];
    for (const side of sides) {
      const opponent = sides.find((s) => s.roster_id !== side.roster_id);
      const roster = rosterMap[side.roster_id];

      let result: string | null = null;
      if (opponent) {
        if (side.points > opponent.points) result = 'win';
        else if (side.points < opponent.points) result = 'loss';
        else result = 'tie';
      }

      const pf = roster
        ? roster.settings.fpts + (roster.settings.fpts_decimal ?? 0) / 100
        : 0;
      const pa = roster
        ? roster.settings.fpts_against + (roster.settings.fpts_against_decimal ?? 0) / 100
        : 0;

      rows.push({
        season_id: seasonId,
        league_id: leagueId,
        week,
        roster_id: side.roster_id,
        points: side.points ?? 0,
        opponent_roster_id: opponent?.roster_id ?? null,
        opponent_points: opponent?.points ?? null,
        result,
        matchup_id: Number(matchupId),
        season_wins: roster?.settings.wins ?? 0,
        season_losses: roster?.settings.losses ?? 0,
        season_ties: roster?.settings.ties ?? 0,
        season_points_for: pf,
        season_points_against: pa,
        streak: roster?.metadata?.streak ?? null,
        is_playoff: false,
        is_bracket: false,
        fetched_at: new Date().toISOString(),
      });
    }
  }

  return rows;
}

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
    const { data: season } = await supabase
      .from('seasons')
      .select('id')
      .eq('is_current', true)
      .limit(1)
      .single();
    if (!season) {
      return NextResponse.json({ error: 'No current season found' }, { status: 400 });
    }
    sId = season.id;
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

  for (const league of LEAGUE_CONFIG.leagues) {
    let totalRows = 0;
    const rosters = await getLeagueRosters(league.id);

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
  });
}
