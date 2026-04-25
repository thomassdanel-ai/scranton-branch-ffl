import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getLeague, getLeagueRosters, getLeagueUsers } from '@/lib/sleeper/api';
import { requireAuth, AuthError } from '@/lib/auth';

// POST: Link Sleeper league IDs and map rosters to members
export async function POST(req: NextRequest) {
  try {
    await requireAuth();

    const body = await req.json();
  const { seasonId, leagueLinks, rosterMappings } = body as {
    seasonId: string;
    leagueLinks: Record<string, string>; // leagueId (ours) -> sleeperLeagueId
    rosterMappings?: Record<string, { sleeper_roster_id: string; sleeper_display_name: string }>; // memberSeasonId -> sleeper info
  };

  if (!seasonId || !leagueLinks) {
    return NextResponse.json({ error: 'Missing seasonId or leagueLinks' }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Validate Sleeper league IDs
  for (const leagueId of Object.keys(leagueLinks)) {
    const sleeperId = leagueLinks[leagueId];
    if (!sleeperId || !/^\d+$/.test(sleeperId)) {
      return NextResponse.json({ error: `Invalid Sleeper league ID for league ${leagueId}` }, { status: 400 });
    }
  }

  // Update league rows with Sleeper IDs and seed roster_positions so the
  // public matchups page can render slot labels without calling Sleeper.
  // The cron sync will continue to refresh roster_positions on each cycle.
  for (const leagueId of Object.keys(leagueLinks)) {
    const sleeperId = leagueLinks[leagueId];
    let rosterPositions: string[] | null = null;
    try {
      const leagueData = await getLeague(sleeperId);
      if (Array.isArray(leagueData?.roster_positions)) {
        rosterPositions = leagueData.roster_positions;
      }
    } catch (err) {
      // Don't block the link operation on a transient Sleeper failure —
      // the cron will populate roster_positions on the next tick.
      console.error(`getLeague failed for ${sleeperId}:`, err);
    }
    await supabase
      .from('leagues')
      .update({
        sleeper_league_id: sleeperId,
        ...(rosterPositions !== null ? { roster_positions: rosterPositions } : {}),
      })
      .eq('id', leagueId);
  }

  // If roster mappings provided, update member_seasons
  if (rosterMappings) {
    for (const msId of Object.keys(rosterMappings)) {
      const mapping = rosterMappings[msId];
      await supabase
        .from('member_seasons')
        .update({
          sleeper_roster_id: mapping.sleeper_roster_id,
          sleeper_display_name: mapping.sleeper_display_name,
        })
        .eq('id', msId);
    }
  }

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}

// GET: Fetch Sleeper rosters for auto-matching
export async function GET(req: NextRequest) {
  try {
    await requireAuth();

    const sleeperLeagueId = req.nextUrl.searchParams.get('sleeper_league_id');
    if (!sleeperLeagueId || !/^\d+$/.test(sleeperLeagueId)) {
      return NextResponse.json({ error: 'Invalid Sleeper league ID' }, { status: 400 });
    }

    const [rosters, users] = await Promise.all([
      getLeagueRosters(sleeperLeagueId),
      getLeagueUsers(sleeperLeagueId),
    ]);

    // Build roster info with display names
    const rosterInfo = rosters.map((r: { roster_id: number; owner_id: string }) => {
      const user = users.find((u: { user_id: string }) => u.user_id === r.owner_id);
      return {
        roster_id: String(r.roster_id),
        owner_id: r.owner_id,
        display_name: user?.display_name || user?.metadata?.team_name || `Roster ${r.roster_id}`,
        team_name: user?.metadata?.team_name || null,
      };
    });

    return NextResponse.json({ rosters: rosterInfo });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: 'Failed to fetch Sleeper data' }, { status: 500 });
  }
}
