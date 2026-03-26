import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServiceClient } from '@/lib/supabase/server';
import { getLeagueStandings } from '@/lib/sleeper/league-data';
import { computePowerRankings } from '@/lib/rankings/compute';
import { loadBracket } from '@/lib/bracket/engine';
import { LEAGUE_CONFIG } from '@/config/leagues';

function isAuthed(): boolean {
  const cookieStore = cookies();
  return cookieStore.get('admin_auth')?.value === 'true';
}

/**
 * POST: Archive the current season.
 * Snapshots standings, power rankings, and bracket data into season_archives.
 */
export async function POST(req: NextRequest) {
  if (!isAuthed()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();

  // Get current season (try status first, fall back to is_current)
  let season: { id: string; year: string } | null = null;

  const { data: byStatus } = await supabase
    .from('seasons')
    .select('id, year')
    .in('status', ['active', 'completed'])
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (byStatus) {
    season = byStatus;
  } else {
    const { data: byCurrent } = await supabase
      .from('seasons')
      .select('id, year')
      .eq('is_current', true)
      .single();
    season = byCurrent;
  }

  if (!season) {
    return NextResponse.json({ error: 'No current season found' }, { status: 400 });
  }

  // Check if already archived
  const { data: existing } = await supabase
    .from('season_archives')
    .select('id')
    .eq('season_id', season.id)
    .limit(1)
    .single();

  if (existing) {
    return NextResponse.json({ error: 'This season has already been archived' }, { status: 400 });
  }

  // Gather final standings for each league
  const finalStandings: Record<string, unknown> = {};
  for (const league of LEAGUE_CONFIG.leagues) {
    try {
      const standings = await getLeagueStandings(league.id);
      finalStandings[league.id] = {
        leagueName: league.name,
        leagueColor: league.color,
        standings,
      };
    } catch {
      finalStandings[league.id] = { leagueName: league.name, error: 'Failed to fetch' };
    }
  }

  // Gather power rankings
  let powerRankings = null;
  try {
    powerRankings = await computePowerRankings();
  } catch {
    // Non-fatal
  }

  // Gather bracket
  let bracket = null;
  try {
    bracket = await loadBracket();
  } catch {
    // Non-fatal
  }

  // Compute awards
  const awards = computeAwards(finalStandings, powerRankings, bracket);

  // Insert archive
  const { error } = await supabase
    .from('season_archives')
    .insert({
      season_id: season.id,
      final_standings: finalStandings,
      champion: bracket?.champion ?? null,
      awards,
    });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Mark season as archived
  await supabase
    .from('seasons')
    .update({ status: 'archived', is_current: false, updated_at: new Date().toISOString() })
    .eq('id', season.id);

  return NextResponse.json({ ok: true, year: season.year });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function computeAwards(standings: Record<string, any>, rankings: any[] | null, bracket: any): Record<string, unknown> {
  const awards: Record<string, unknown> = {};

  // Most Points (across all leagues)
  let topScorer: { name: string; points: number; league: string } | null = null;
  for (const leagueId of Object.keys(standings)) {
    const leagueData = standings[leagueId];
    if (!leagueData.standings) continue;
    for (const team of leagueData.standings) {
      const pf = team.team?.pointsFor ?? team.pointsFor ?? 0;
      const name = team.team?.teamName ?? team.team?.displayName ?? 'Unknown';
      if (!topScorer || pf > topScorer.points) {
        topScorer = { name, points: pf, league: leagueData.leagueName };
      }
    }
  }
  if (topScorer) awards.mostPoints = topScorer;

  // Best Record
  let bestRecord: { name: string; wins: number; losses: number; league: string } | null = null;
  for (const leagueId of Object.keys(standings)) {
    const leagueData = standings[leagueId];
    if (!leagueData.standings) continue;
    for (const team of leagueData.standings) {
      const wins = team.team?.wins ?? 0;
      const losses = team.team?.losses ?? 0;
      const name = team.team?.teamName ?? team.team?.displayName ?? 'Unknown';
      if (!bestRecord || wins > bestRecord.wins || (wins === bestRecord.wins && losses < bestRecord.losses)) {
        bestRecord = { name, wins, losses, league: leagueData.leagueName };
      }
    }
  }
  if (bestRecord) awards.bestRecord = bestRecord;

  // #1 Power Ranked
  if (rankings && rankings.length > 0) {
    const top = rankings[0];
    awards.topPowerRanked = {
      name: top.team?.teamName ?? top.team?.displayName ?? 'Unknown',
      score: top.powerScore,
      league: top.leagueName,
    };
  }

  // Champion
  if (bracket?.champion) {
    awards.champion = {
      name: bracket.champion.teamName,
      league: bracket.champion.leagueName,
    };
  }

  return awards;
}
