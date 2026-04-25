import { NextRequest, NextResponse } from 'next/server';
import { getNFLState, getLeague, getLeagueRosters, getMatchups, getTransactions } from '@/lib/sleeper/api';
import { createServiceClient } from '@/lib/supabase/server';
import { computePowerRankings } from '@/lib/rankings/compute';
import { buildWeeklyResults, buildPlayerScores } from '@/lib/weekly-results';
import { getSeasonLeagues, getActiveSeasonId } from '@/lib/config';
import { resolveMemberSeasonsBatch } from '@/lib/member-resolver';
import { isCronAuthorized } from '@/lib/cron-auth';

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

async function findSeasonId(): Promise<string> {
  const activeId = await getActiveSeasonId();
  if (activeId) return activeId;

  throw new Error('No active season found. Create one via the admin setup wizard.');
}

// Auto-save finalized weeks that haven't been saved yet
async function saveCompletedWeeks(
  supabase: ReturnType<typeof createServiceClient>,
  seasonId: string,
  currentNFLWeek: number
) {
  if (currentNFLWeek <= 1) return 0;

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

  const leagues = await getSeasonLeagues(seasonId);
  let savedCount = 0;

  for (let week = lastSaved + 1; week <= lastFinalized; week++) {
    for (const league of leagues) {
      try {
        const [matchups, rosters, leagueData] = await Promise.all([
          getMatchups(league.sleeperId, week),
          getLeagueRosters(league.sleeperId),
          getLeague(league.sleeperId),
        ]);

        if (!matchups.length) continue;

        const msMap = await resolveMemberSeasonsBatch(seasonId, league.sleeperId);

        const rows = buildWeeklyResults(seasonId, league.sleeperId, week, matchups, rosters, msMap);
        if (rows.length > 0) {
          const { error } = await supabase
            .from('weekly_results')
            .upsert(rows, { onConflict: 'league_id,week,roster_id', ignoreDuplicates: true });
          if (!error) savedCount += rows.length;
        }

        const rosterPositions = leagueData.roster_positions.filter(
          (pos) => pos !== 'BN' && pos !== 'IR'
        );
        const playerRows = buildPlayerScores(seasonId, league.sleeperId, week, matchups, rosterPositions, msMap);
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
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const nflState = await getNFLState();

    if (!shouldSync(nflState)) {
      return NextResponse.json({ skipped: true, reason: 'Not sync time' });
    }

    const week = nflState.week;
    const supabase = createServiceClient();
    const seasonId = await findSeasonId();
    const leagues = await getSeasonLeagues(seasonId);
    const results: Record<string, unknown> = {};
    const now = new Date().toISOString();

    // Fetch all leagues in parallel (Sleeper allows 1000 calls/min).
    // `getLeague` is included so we can refresh `roster_positions` on the
    // leagues row — used by the public matchups page to render slot labels.
    const leagueResults = await Promise.allSettled(
      leagues.map(async (league) => {
        const [rosters, matchups, transactions, leagueData] = await Promise.all([
          getLeagueRosters(league.sleeperId),
          getMatchups(league.sleeperId, week),
          getTransactions(league.sleeperId, week),
          getLeague(league.sleeperId),
        ]);
        return { league, rosters, matchups, transactions, leagueData };
      })
    );

    // Collect rows for batch upsert
    const snapshotRows: Array<Record<string, unknown>> = [];
    const txRows: Array<Record<string, unknown>> = [];
    const rosterPositionUpdates: Array<{ id: string; roster_positions: string[] }> = [];

    for (const result of leagueResults) {
      if (result.status === 'rejected') {
        console.error('League fetch failed:', result.reason);
        continue;
      }
      const { league, rosters, matchups, transactions, leagueData } = result.value;

      snapshotRows.push({
        season_id: seasonId,
        league_id: league.sleeperId,
        week,
        standings: rosters,
        matchups,
        fetched_at: now,
      });

      txRows.push({
        season_id: seasonId,
        league_id: league.sleeperId,
        week,
        transactions,
        fetched_at: now,
      });

      if (Array.isArray(leagueData?.roster_positions)) {
        rosterPositionUpdates.push({
          id: league.dbId,
          roster_positions: leagueData.roster_positions,
        });
      }

      results[league.sleeperId] = {
        league: league.name,
        week,
        rosters: rosters.length,
        matchups: matchups.length,
        transactions: transactions.length,
      };
    }

    // Batch upsert snapshots and transactions in parallel. Roster-position
    // refreshes are non-critical (next cron tick retries), so they run
    // alongside but their errors are logged rather than thrown.
    const [snapshotResult, txResult] = await Promise.all([
      snapshotRows.length > 0
        ? supabase.from('league_snapshots').upsert(snapshotRows, { onConflict: 'league_id,week' })
        : { error: null },
      txRows.length > 0
        ? supabase.from('transactions_cache').upsert(txRows, { onConflict: 'league_id,week' })
        : { error: null },
    ]);

    if (snapshotResult.error) throw new Error(`Snapshot batch upsert failed: ${snapshotResult.error.message}`);
    if (txResult.error) throw new Error(`Transactions batch upsert failed: ${txResult.error.message}`);

    if (rosterPositionUpdates.length > 0) {
      const rosterPositionResults = await Promise.allSettled(
        rosterPositionUpdates.map((row) =>
          supabase
            .from('leagues')
            .update({ roster_positions: row.roster_positions })
            .eq('id', row.id),
        ),
      );
      for (const r of rosterPositionResults) {
        if (r.status === 'rejected') console.error('roster_positions update failed:', r.reason);
      }
    }

    const autoSaved = await saveCompletedWeeks(supabase, seasonId, week);

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
