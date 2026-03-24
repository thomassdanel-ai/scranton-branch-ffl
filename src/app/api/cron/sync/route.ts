import { NextRequest, NextResponse } from 'next/server';
import { LEAGUE_CONFIG } from '@/config/leagues';
import { getNFLState, getLeagueRosters, getMatchups, getTransactions } from '@/lib/sleeper/api';
import { createServiceClient } from '@/lib/supabase/server';

function isGameDay(): boolean {
  const day = new Date().getDay();
  return day === 0 || day === 1 || day === 4; // Sun, Mon, Thu
}

function isGameHours(): boolean {
  const hour = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })).getHours();
  return hour >= 12 && hour <= 23;
}

function shouldSync(nflState: { season_type: string }): boolean {
  if (nflState.season_type === 'off') return false; // handled by daily cron
  if (isGameDay() && isGameHours()) return true;
  // Non-game slots: only sync on 30-min boundaries (when minute is 0 or 30)
  const minute = new Date().getMinutes();
  return minute < 5 || (minute >= 30 && minute < 35);
}

async function getOrCreateSeasonId(supabase: ReturnType<typeof createServiceClient>, season: string): Promise<string> {
  // Try to find the current season record
  const { data: existing } = await supabase
    .from('seasons')
    .select('id')
    .eq('year', season)
    .eq('is_current', true)
    .single();

  if (existing) return existing.id;

  // Create it if it doesn't exist
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

export async function GET(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get('authorization');
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
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

      // Persist to Supabase
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

    return NextResponse.json({
      synced: true,
      week,
      season: nflState.season,
      leagues: results,
    });
  } catch (err) {
    console.error('Cron sync error:', err);
    return NextResponse.json(
      { error: 'Sync failed', detail: String(err) },
      { status: 500 }
    );
  }
}
