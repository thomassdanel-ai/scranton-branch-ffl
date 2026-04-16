import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAuth, AuthError } from '@/lib/auth';
import { getLeagueUsers, getLeagueRosters } from '@/lib/sleeper/api';

export async function POST(req: NextRequest) {
  try {
    await requireAuth();
    const supabase = createServiceClient();
    const { seasonId, leagueId } = await req.json();

    if (!seasonId) {
      return NextResponse.json({ error: 'seasonId required' }, { status: 400 });
    }

    // Get leagues to check
    let leagueQuery = supabase
      .from('leagues')
      .select('id, name, sleeper_league_id')
      .eq('season_id', seasonId)
      .not('sleeper_league_id', 'is', null);

    if (leagueId) {
      leagueQuery = leagueQuery.eq('id', leagueId);
    }

    const { data: leagues } = await leagueQuery;
    if (!leagues || leagues.length === 0) {
      return NextResponse.json({ results: [], message: 'No linked leagues to check' });
    }

    const results = [];

    for (const league of leagues) {
      // Get pending member_seasons with Sleeper usernames
      const { data: pendingMembers } = await supabase
        .from('member_seasons')
        .select('id, members(sleeper_username)')
        .eq('league_id', league.id)
        .in('enrollment_status', ['pending', 'invited']);

      if (!pendingMembers || pendingMembers.length === 0) {
        results.push({ leagueId: league.id, leagueName: league.name, newEnrollments: 0, stillPending: 0 });
        continue;
      }

      // Fetch fresh data from Sleeper
      const [sleeperUsers, sleeperRosters] = await Promise.all([
        getLeagueUsers(league.sleeper_league_id!, true),
        getLeagueRosters(league.sleeper_league_id!, true),
      ]);

      let newEnrollments = 0;
      let stillPending = 0;

      for (const ms of pendingMembers) {
        const member = ms.members as unknown as { sleeper_username: string | null } | null;
        const username = member?.sleeper_username;

        if (!username) {
          stillPending++;
          continue;
        }

        // Match by username (case-insensitive)
        const matchedUser = sleeperUsers.find(
          (u) => u.username?.toLowerCase() === username.toLowerCase()
        );

        if (!matchedUser) {
          stillPending++;
          continue;
        }

        // Find their roster
        const matchedRoster = sleeperRosters.find(
          (r) => r.owner_id === matchedUser.user_id
        );

        // Update member_season with enrollment
        await supabase.from('member_seasons').update({
          enrollment_status: 'enrolled',
          sleeper_roster_id: matchedRoster ? String(matchedRoster.roster_id) : null,
          sleeper_display_name: matchedUser.display_name || matchedUser.username,
        }).eq('id', ms.id);

        newEnrollments++;
      }

      // Update last check timestamp
      await supabase.from('leagues').update({
        last_enrollment_check_at: new Date().toISOString(),
      }).eq('id', league.id);

      results.push({
        leagueId: league.id,
        leagueName: league.name,
        newEnrollments,
        stillPending,
      });
    }

    return NextResponse.json({ results });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
