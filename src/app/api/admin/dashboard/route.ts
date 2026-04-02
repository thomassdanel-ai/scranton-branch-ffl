import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAuth, AuthError } from '@/lib/auth';
import { getScopedCohortIds } from '@/lib/auth-scope';

export async function GET() {
  try {
    const user = await requireAuth();
    const supabase = createServiceClient();

    // Get active season
    const { data: season } = await supabase
      .from('seasons')
      .select('id, season_number, year, status, num_leagues, roster_size_per_league, settings, created_at')
      .in('status', ['setup', 'registering', 'confirming', 'pre_draft', 'drafting', 'active', 'playoffs', 'completed'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!season) {
      return NextResponse.json({ season: null, cohorts: [], registrations: [], leagues: [] });
    }

    // Fetch cohorts (scoped)
    const scopedIds = await getScopedCohortIds(user, season.id);
    let cohortsQuery = supabase
      .from('cohorts')
      .select('id, name, color, status, invite_token, settings, created_at, season_registrations(count)')
      .eq('season_id', season.id)
      .order('created_at');

    if (scopedIds) {
      cohortsQuery = cohortsQuery.in('id', scopedIds.length > 0 ? scopedIds : ['_none_']);
    }

    const { data: cohorts } = await cohortsQuery;

    // Fetch recent registrations (last 20)
    const { data: recentRegs } = await supabase
      .from('season_registrations')
      .select('id, status, registered_at, confirmed_at, cohort_id, members(full_name, display_name, email)')
      .eq('season_id', season.id)
      .order('registered_at', { ascending: false })
      .limit(20);

    // Fetch leagues with draft status
    const { data: leagues } = await supabase
      .from('leagues')
      .select('id, name, short_name, color, sleeper_league_id, position')
      .eq('season_id', season.id)
      .order('position');

    // Fetch member counts per league
    const { data: memberSeasons } = await supabase
      .from('member_seasons')
      .select('id, league_id')
      .eq('season_id', season.id);

    // Fetch draft boards
    const { data: draftBoards } = await supabase
      .from('draft_boards')
      .select('id, league_id, status, sleeper_draft_id, is_mock, last_synced_at')
      .eq('season_id', season.id);

    // Fetch latest weekly results for league leaders
    const { data: latestResults } = await supabase
      .from('weekly_results')
      .select('league_id, roster_id, wins, losses, points_for, member_season_id')
      .eq('season_id', season.id)
      .eq('is_bracket', false)
      .order('week', { ascending: false })
      .limit(100);

    // Build league health data
    const leagueHealth = (leagues || []).map((league) => {
      const memberCount = (memberSeasons || []).filter((ms) => ms.league_id === league.id).length;
      const board = (draftBoards || []).find((b) => b.league_id === league.id && !b.is_mock);
      const leagueResults = (latestResults || []).filter((r) => r.league_id === league.sleeper_league_id);

      // Find leader by most wins, then PF
      let leader = null;
      if (leagueResults.length > 0) {
        const best = leagueResults.reduce((a, b) =>
          (b.wins > a.wins || (b.wins === a.wins && b.points_for > a.points_for)) ? b : a
        );
        leader = {
          memberSeasonId: best.member_season_id,
          record: `${best.wins}-${best.losses}`,
          pointsFor: best.points_for,
        };
      }

      return {
        id: league.id,
        name: league.name,
        shortName: league.short_name,
        color: league.color,
        sleeperId: league.sleeper_league_id,
        memberCount,
        draftStatus: board?.status || 'none',
        sleeperLinked: !!league.sleeper_league_id,
        leader,
      };
    });

    // Fetch member names for leader display
    const leaderMsIds = leagueHealth
      .filter((l) => l.leader?.memberSeasonId)
      .map((l) => l.leader!.memberSeasonId);

    let leaderNames: Record<string, string> = {};
    if (leaderMsIds.length > 0) {
      const { data: msData } = await supabase
        .from('member_seasons')
        .select('id, member_id')
        .in('id', leaderMsIds);

      if (msData) {
        const memberIds = msData.map((ms) => ms.member_id);
        const { data: membersData } = await supabase
          .from('members')
          .select('id, full_name, display_name')
          .in('id', memberIds.length > 0 ? memberIds : ['_none_']);

        if (membersData) {
          for (const ms of msData) {
            const member = membersData.find((m) => m.id === ms.member_id);
            if (member) {
              leaderNames[ms.id] = member.display_name || member.full_name;
            }
          }
        }
      }
    }

    return NextResponse.json({
      season,
      cohorts: cohorts || [],
      recentRegistrations: (recentRegs || []).map((r) => {
        const cohort = (cohorts || []).find((c) => c.id === r.cohort_id);
        return {
          ...r,
          cohortName: cohort?.name || 'Unknown',
          cohortColor: cohort?.color || '#6b7280',
        };
      }),
      leagueHealth: leagueHealth.map((l) => ({
        ...l,
        leaderName: l.leader?.memberSeasonId ? leaderNames[l.leader.memberSeasonId] || null : null,
      })),
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
