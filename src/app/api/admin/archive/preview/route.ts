import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getLeagueStandings } from '@/lib/sleeper/league-data';
import { computePowerRankings } from '@/lib/rankings/compute';
import { loadBracket, computeBracketStatus } from '@/lib/bracket/engine';
import { getSeasonLeagues } from '@/lib/config';
import { requireAuth, AuthError } from '@/lib/auth';

export async function GET() {
  try {
    await requireAuth();

    const supabase = createServiceClient();

    const { data: season } = await supabase
      .from('seasons')
      .select('id, year')
      .in('status', ['active', 'completed', 'playoffs'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!season) {
      return NextResponse.json({ error: 'No current season found' }, { status: 400 });
    }

    const leagues = await getSeasonLeagues(season.id);

    // Gather standings per league
    const leagueStandings: { leagueName: string; leagueColor: string; teams: { name: string; wins: number; losses: number; pointsFor: number }[] }[] = [];

    for (const league of leagues) {
      try {
        const standings = await getLeagueStandings(league.sleeperId);
        leagueStandings.push({
          leagueName: league.name,
          leagueColor: league.color,
          teams: standings.slice(0, 3).map((t) => ({
            name: t.teamName || t.displayName || 'Unknown',
            wins: t.wins,
            losses: t.losses,
            pointsFor: t.pointsFor,
          })),
        });
      } catch {
        leagueStandings.push({
          leagueName: league.name,
          leagueColor: league.color,
          teams: [],
        });
      }
    }

    // Awards
    const awards: Record<string, { name: string; league?: string }> = {};

    // Most points across all leagues
    let topScorer: { name: string; points: number; league: string } | null = null;
    let bestRecord: { name: string; wins: number; losses: number; league: string } | null = null;

    for (const ls of leagueStandings) {
      for (const team of ls.teams) {
        if (!topScorer || team.pointsFor > topScorer.points) {
          topScorer = { name: team.name, points: team.pointsFor, league: ls.leagueName };
        }
        if (!bestRecord || team.wins > bestRecord.wins || (team.wins === bestRecord.wins && team.losses < bestRecord.losses)) {
          bestRecord = { name: team.name, wins: team.wins, losses: team.losses, league: ls.leagueName };
        }
      }
    }

    if (topScorer) awards.mostPoints = { name: `${topScorer.name} (${topScorer.points.toFixed(1)} pts)`, league: topScorer.league };
    if (bestRecord) awards.bestRecord = { name: `${bestRecord.name} (${bestRecord.wins}-${bestRecord.losses})`, league: bestRecord.league };

    // Power rankings #1
    try {
      const rankings = await computePowerRankings();
      if (rankings.length > 0) {
        const top = rankings[0];
        awards.topPowerRanked = { name: top.team.teamName || top.team.displayName, league: top.leagueName };
      }
    } catch {
      // Non-fatal
    }

    // Bracket
    let bracketStatus: 'complete' | 'in_progress' | 'not_set_up' = 'not_set_up';
    try {
      const bracket = await loadBracket();
      if (bracket?.matchups) {
        const status = computeBracketStatus(bracket.matchups);
        bracketStatus = status === 'pending' ? 'not_set_up' : status === 'in_progress' ? 'in_progress' : 'complete';
        if (bracket.champion) {
          awards.champion = { name: bracket.champion.teamName, league: bracket.champion.leagueName };
        }
      }
    } catch {
      // Non-fatal
    }

    return NextResponse.json({
      preview: {
        leagueStandings,
        awards,
        bracketStatus,
      },
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
