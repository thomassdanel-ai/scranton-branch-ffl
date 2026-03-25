import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServiceClient } from '@/lib/supabase/server';
import { getLeagueRosters, getLeagueUsers } from '@/lib/sleeper/api';

function isAuthed(): boolean {
  const cookieStore = cookies();
  return cookieStore.get('admin_auth')?.value === 'true';
}

// POST: Link Sleeper league IDs and map rosters to members
export async function POST(req: NextRequest) {
  if (!isAuthed()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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

  // Update league rows with Sleeper IDs
  for (const leagueId of Object.keys(leagueLinks)) {
    await supabase
      .from('leagues')
      .update({ sleeper_league_id: leagueLinks[leagueId] })
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
}

// GET: Fetch Sleeper rosters for auto-matching
export async function GET(req: NextRequest) {
  if (!isAuthed()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sleeperLeagueId = req.nextUrl.searchParams.get('sleeper_league_id');
  if (!sleeperLeagueId || !/^\d+$/.test(sleeperLeagueId)) {
    return NextResponse.json({ error: 'Invalid Sleeper league ID' }, { status: 400 });
  }

  try {
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
  } catch {
    return NextResponse.json({ error: 'Failed to fetch Sleeper data' }, { status: 500 });
  }
}
