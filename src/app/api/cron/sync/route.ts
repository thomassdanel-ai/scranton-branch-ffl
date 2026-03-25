import { NextRequest, NextResponse } from 'next/server';
import { LEAGUE_CONFIG } from '@/config/leagues';
import { getNFLState, getLeagueRosters, getMatchups, getTransactions } from '@/lib/sleeper/api';
import { createServiceClient } from '@/lib/supabase/server';
import { computePowerRankings } from '@/lib/rankings/compute';
import type { SleeperMatchup, SleeperRoster } from '@/lib/sleeper/types';

function isGameDay(): boolean {
  const day = new Date().getDay();
  return day === 0 || day === 1 || day === 4; // Sun, Mon, Thu
}

function isGameHours(): boolean {
  const hour = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })).getHours();
  return hour >= 12 && hour <= 23;
}

function shouldSync(nflState: { season_type: string }): boolean {
  if (nflState.season_type === 'off') return false;
  if (isGameDay() && isGameHours()) return true;
  const minute = new Date().getMinutes();
  return minute < 5 || (minute >= 30 && minute < 35);
}

async function getOrCreateSeasonId(supabase: ReturnType<typeof createServiceClient>, season: string): Promise<string> {
  const { data: existing } = await supabase
    .from('seasons')
    .select('id')
    .eq('year', season)
    .eq('is_current', true)
    .single();

  if (existing) return existing.id;

  const { data: created, error } = await supabase
    .from('seasons')
    .insert({
      year: season,
      is_current: true,
      config: LEAGUE_CONFIG,
    })
    .select('id')
    .single();

  if (error || !created) throw new Error(`Failed to create season record: ${error?.message}`);
  return created.id;
}

function buildWeeklyResults(
  seasonId: string,
  leagueId: string,
  week: number,
  matchups: SleeperMatchup[],
  rosters: SleeperRoster[]
) {
  // Group matchups by matchup_id to find opponents
  const grouped: Record<number, SleeperMatchup[]> = {};
  for (const m of matchups) {
    if (!m.matchup_id) continue;
    if (!grouped[m.matchup_id]) grouped[m.matchup_id] = [];
    grouped[m.matchup_id].push(m);
  }

  // Build roster lookup for season-to-date stats
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

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authHeader = req.headers.get('authorization');
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const nflState = await getNFLState();

    if (!shouldSync(nflState)) {
      return NextResponse.json({ skipped: true, reason: 'Not sync time' });
    }

    const week = nflState.week;
    const supabase = createServiceClient();
    const seasonId = await getOrCreateSeasonId(supabase, nflState.season);
    const results: Record<string, unknown> = {};

    for (const league of LEAGUE_CONFIG.leagues) {
      const [rosters, matchups, transactions] = await Promise.all([
        getLeagueRosters(league.id),
        getMatchups(league.id, week),
        getTransactions(league.id, week),
      ]);

      // Persist snapshots + transactions
      const [snapshotResult, txResult] = await Promise.all([
        supabase.from('league_snapshots').upsert(
          {
            season_id: seasonId,
            league_id: league.id,
            week,
            standings: rosters,
            matchups,
            fetched_at: new Date().toISOString(),
          },
          { onConflict: 'league_id,week' }
        ),
        supabase.from('transactions_cache').upsert(
          {
            season_id: seasonId,
            league_id: league.id,
            week,
            transactions,
            fetched_at: new Date().toISOString(),
          },
          { onConflict: 'league_id,week' }
        ),
      ]);

      if (snapshotResult.error) throw new Error(`Snapshot upsert failed (${league.name}): ${snapshotResult.error.message}`);
      if (txResult.error) throw new Error(`Transactions upsert failed (${league.name}): ${txResult.error.message}`);

      // Write weekly results (append-only via upsert)
      const weeklyRows = buildWeeklyResults(seasonId, league.id, week, matchups, rosters);
      if (weeklyRows.length > 0) {
        const { error: wrErr } = await supabase
          .from('weekly_results')
          .upsert(weeklyRows, { onConflict: 'league_id,week,roster_id' });
        if (wrErr) {
          console.error(`Weekly results upsert failed (${league.name}):`, wrErr.message);
        }
      }

      results[league.id] = {
        league: league.name,
        week,
        rosters: rosters.length,
        matchups: matchups.length,
        transactions: transactions.length,
        weeklyResults: weeklyRows.length,
      };
    }

    // Persist power rankings for this week
    try {
      const rankings = await computePowerRankings();
      if (rankings.length > 0) {
        await supabase.from('power_rankings').upsert(
          {
            season_id: seasonId,
            week,
            rankings,
            computed_at: new Date().toISOString(),
          },
          { onConflict: 'season_id,week' }
        );
      }
    } catch (err) {
      console.error('Power rankings compute failed:', err);
    }

    return NextResponse.json({
      synced: true,
      week,
      season: nflState.season,
      leagues: results,
    });
  } catch (err) {
    console.error('Cron sync error:', err);
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
  }
}
