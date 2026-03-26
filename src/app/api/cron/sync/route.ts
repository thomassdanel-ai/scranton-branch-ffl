import { NextRequest, NextResponse } from 'next/server';
import { LEAGUE_CONFIG } from '@/config/leagues';
import { getNFLState, getLeague, getLeagueRosters, getMatchups, getTransactions } from '@/lib/sleeper/api';
import { createServiceClient } from '@/lib/supabase/server';
import { computePowerRankings } from '@/lib/rankings/compute';
import { buildWeeklyResults, buildPlayerScores } from '@/lib/weekly-results';

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

async function findSeasonId(supabase: ReturnType<typeof createServiceClient>, year: string): Promise<string> {
  // Try new status-based lookup first (active or drafting seasons)
  const { data: byStatus } = await supabase
    .from('seasons')
    .select('id')
    .in('status', ['active', 'drafting'])
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (byStatus) return byStatus.id;

  // Fallback: old is_current boolean for legacy season rows
  const { data: byCurrent } = await supabase
    .from('seasons')
    .select('id')
    .eq('year', year)
    .eq('is_current', true)
    .single();

  if (byCurrent) return byCurrent.id;

  // Last resort: create a season record
  const { data: created, error } = await supabase
    .from('seasons')
    .insert({
      year,
      is_current: true,
      status: 'active',
      config: LEAGUE_CONFIG,
    })
    .select('id')
    .single();

  if (error || !created) throw new Error(`Failed to create season record: ${error?.message}`);
  return created.id;
}

// Auto-save finalized weeks that haven't been saved yet
async function saveCompletedWeeks(
  supabase: ReturnType<typeof createServiceClient>,
  seasonId: string,
  currentNFLWeek: number
) {
  // Finalized weeks are 1 through (currentNFLWeek - 1)
  if (currentNFLWeek <= 1) return 0;

  // Find the highest week already saved
  const { data: latest } = await supabase
    .from('weekly_results')
    .select('week')
    .eq('season_id', seasonId)
    .eq('is_bracket', false)
    .order('week', { ascending: false })
    .limit(1)
    .single();

  const lastSaved = latest?.week ?? 0;
  const lastFinalized = currentNFLWeek - 1;

  if (lastSaved >= lastFinalized) return 0;

  let savedCount = 0;

  for (let week = lastSaved + 1; week <= lastFinalized; week++) {
    for (const league of LEAGUE_CONFIG.leagues) {
      try {
        const [matchups, rosters, leagueData] = await Promise.all([
          getMatchups(league.id, week),
          getLeagueRosters(league.id),
          getLeague(league.id),
        ]);

        if (!matchups.length) continue;

        const rows = buildWeeklyResults(seasonId, league.id, week, matchups, rosters);
        if (rows.length > 0) {
          // INSERT with ON CONFLICT DO NOTHING — never overwrite finalized data
          const { error } = await supabase
            .from('weekly_results')
            .upsert(rows, { onConflict: 'league_id,week,roster_id', ignoreDuplicates: true });
          if (!error) savedCount += rows.length;
        }

        // Also save per-player scores (starters + bench)
        const rosterPositions = leagueData.roster_positions.filter(
          (pos) => pos !== 'BN' && pos !== 'IR'
        );
        const playerRows = buildPlayerScores(seasonId, league.id, week, matchups, rosterPositions);
        if (playerRows.length > 0) {
          await supabase
            .from('player_weekly_scores')
            .upsert(playerRows, { onConflict: 'league_id,week,roster_id,player_id', ignoreDuplicates: true });
        }
      } catch {
        // Skip weeks with no data
      }
    }
  }

  return savedCount;
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
    const seasonId = await findSeasonId(supabase, nflState.season);
    const results: Record<string, unknown> = {};

    for (const league of LEAGUE_CONFIG.leagues) {
      const [rosters, matchups, transactions] = await Promise.all([
        getLeagueRosters(league.id),
        getMatchups(league.id, week),
        getTransactions(league.id, week),
      ]);

      // Persist live snapshots + transactions (current week, overwritten each sync)
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

      results[league.id] = {
        league: league.name,
        week,
        rosters: rosters.length,
        matchups: matchups.length,
        transactions: transactions.length,
      };
    }

    // Auto-save any finalized weeks not yet in weekly_results
    const autoSaved = await saveCompletedWeeks(supabase, seasonId, week);

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
      autoSavedResults: autoSaved,
    });
  } catch (err) {
    console.error('Cron sync error:', err);
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
  }
}
