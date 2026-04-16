import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAuth, AuthError } from '@/lib/auth';

export async function GET() {
  try {
    await requireAuth();
    const supabase = createServiceClient();

    // Find the drafting/active season (include confirming for enrollment phase)
    const { data: season } = await supabase
      .from('seasons')
      .select('id, season_number, year, status')
      .in('status', ['drafting', 'active', 'pre_draft', 'confirming'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!season) {
      return NextResponse.json({ season: null, phase: 'idle', drafts: [], recentActivity: [] });
    }

    // Fetch all draft boards for this season (non-mock)
    const { data: boards } = await supabase
      .from('draft_boards')
      .select('id, league_id, status, num_rounds, current_round, current_pick, sleeper_draft_id, last_synced_at, is_mock, started_at, completed_at')
      .eq('season_id', season.id)
      .eq('is_mock', false);

    // Determine phase: enrollment vs drafting
    const activeDraftBoards = (boards || []).filter(
      (b) => b.status === 'drafting' || b.status === 'completed'
    );
    const hasDrafting = activeDraftBoards.length > 0;

    // Check if we have leagues + member_seasons for enrollment phase
    const { data: seasonLeagues } = await supabase
      .from('leagues')
      .select('id')
      .eq('season_id', season.id)
      .limit(1);

    const { count: memberSeasonCount } = await supabase
      .from('member_seasons')
      .select('id', { count: 'exact', head: true })
      .eq('season_id', season.id);

    const hasLeaguesAndMembers = (seasonLeagues?.length ?? 0) > 0 && (memberSeasonCount ?? 0) > 0;
    const phase = hasDrafting ? 'drafting' : hasLeaguesAndMembers ? 'enrollment' : 'idle';

    // If enrollment phase, return enrollment data
    if (phase === 'enrollment') {
      const { data: leagues } = await supabase
        .from('leagues')
        .select('id, name, short_name, color, sleeper_league_id, sleeper_invite_link, last_enrollment_check_at')
        .eq('season_id', season.id);

      const { data: memberSeasons } = await supabase
        .from('member_seasons')
        .select('id, league_id, enrollment_status, invite_sent_at, reminder_sent_at, sleeper_roster_id, members(full_name, email, sleeper_username)')
        .eq('season_id', season.id);

      const enrollmentLeagues = (leagues || []).map((league) => {
        const members = (memberSeasons || [])
          .filter((ms) => ms.league_id === league.id)
          .map((ms) => {
            const member = ms.members as unknown as { full_name: string; email: string; sleeper_username: string | null } | null;
            return {
              memberSeasonId: ms.id,
              name: member?.full_name ?? 'Unknown',
              email: member?.email ?? '',
              sleeperUsername: member?.sleeper_username ?? null,
              enrollmentStatus: ms.enrollment_status ?? 'pending',
              inviteSentAt: ms.invite_sent_at,
              reminderSentAt: ms.reminder_sent_at,
              sleeperRosterId: ms.sleeper_roster_id,
            };
          });

        return {
          leagueId: league.id,
          leagueName: league.name,
          leagueShortName: league.short_name,
          leagueColor: league.color || '#6b7280',
          sleeperLeagueId: league.sleeper_league_id,
          sleeperInviteLink: league.sleeper_invite_link,
          lastCheckAt: league.last_enrollment_check_at,
          members,
        };
      });

      const allMembers = enrollmentLeagues.flatMap((l) => l.members);
      const summary = {
        totalMembers: allMembers.length,
        enrolled: allMembers.filter((m) => m.enrollmentStatus === 'enrolled').length,
        invited: allMembers.filter((m) => m.enrollmentStatus === 'invited').length,
        pending: allMembers.filter((m) => m.enrollmentStatus === 'pending').length,
      };

      return NextResponse.json({
        season,
        phase,
        enrollment: { leagues: enrollmentLeagues, summary },
        drafts: [],
        recentActivity: [],
      });
    }

    if (!boards || boards.length === 0) {
      return NextResponse.json({ season, phase, drafts: [], recentActivity: [] });
    }

    // Fetch leagues
    const leagueIds = boards.map((b) => b.league_id);
    const { data: leagues } = await supabase
      .from('leagues')
      .select('id, name, short_name, color')
      .in('id', leagueIds);

    // Fetch all picks for active boards (expanded limit)
    const boardIds = boards.map((b) => b.id);
    const { data: allPicks } = await supabase
      .from('draft_picks')
      .select('id, draft_board_id, member_season_id, round, pick_in_round, overall_pick, player_name, position, picked_at')
      .in('draft_board_id', boardIds)
      .not('player_name', 'is', null)
      .order('picked_at', { ascending: false })
      .limit(500);

    // Fetch member_seasons and members for name resolution
    const msIds = Array.from(new Set((allPicks || []).map((p) => p.member_season_id).filter(Boolean)));
    const memberNames: Record<string, string> = {};

    if (msIds.length > 0) {
      const { data: msData } = await supabase
        .from('member_seasons')
        .select('id, member_id')
        .in('id', msIds);

      if (msData && msData.length > 0) {
        const memberIds = Array.from(new Set(msData.map((ms) => ms.member_id)));
        const { data: membersData } = await supabase
          .from('members')
          .select('id, full_name, display_name')
          .in('id', memberIds);

        if (membersData) {
          for (const ms of msData) {
            const member = membersData.find((m) => m.id === ms.member_id);
            if (member) {
              memberNames[ms.id] = member.display_name || member.full_name;
            }
          }
        }
      }
    }

    // Get roster sizes per league
    const { data: memberSeasonCounts } = await supabase
      .from('member_seasons')
      .select('league_id')
      .eq('season_id', season.id);

    const rosterSizes: Record<string, number> = {};
    for (const ms of memberSeasonCounts || []) {
      rosterSizes[ms.league_id] = (rosterSizes[ms.league_id] || 0) + 1;
    }

    // Build draft summaries with expanded data
    const drafts = boards.map((board) => {
      const league = (leagues || []).find((l) => l.id === board.league_id);
      const boardPicks = (allPicks || []).filter((p) => p.draft_board_id === board.id);
      const teamCount = rosterSizes[board.league_id] || 0;
      const totalPicks = board.num_rounds * teamCount;
      const picksMade = boardPicks.length;

      // Current pick info
      let currentPick = null;
      if (board.status === 'drafting' || board.status === 'paused') {
        const currentPickObj = boardPicks.find(
          (p) => p.round === board.current_round && p.pick_in_round === board.current_pick
        );
        if (currentPickObj) {
          currentPick = {
            round: board.current_round,
            pick: board.current_pick,
            teamName: memberNames[currentPickObj.member_season_id] || 'Unknown',
            memberSeasonId: currentPickObj.member_season_id,
          };
        } else {
          currentPick = {
            round: board.current_round,
            pick: board.current_pick,
            teamName: 'TBD',
            memberSeasonId: null,
          };
        }
      }

      // Recent picks (expanded to 10)
      const recentPicks = boardPicks.slice(0, 10).map((p) => ({
        playerName: p.player_name,
        teamName: memberNames[p.member_season_id] || 'Unknown',
        round: p.round,
        pick: p.pick_in_round,
        timestamp: p.picked_at,
        position: p.position,
      }));

      // Position breakdown
      const positionBreakdown: Record<string, number> = {};
      for (const pick of boardPicks) {
        const pos = pick.position || 'Unknown';
        positionBreakdown[pos] = (positionBreakdown[pos] || 0) + 1;
      }

      // Team rosters grouped by member_season_id
      const teamPicksMap: Record<string, typeof boardPicks> = {};
      for (const pick of boardPicks) {
        const msId = pick.member_season_id || 'unknown';
        if (!teamPicksMap[msId]) teamPicksMap[msId] = [];
        teamPicksMap[msId].push(pick);
      }

      const teamRosters = Object.entries(teamPicksMap).map(([msId, picks]) => {
        const sortedPicks = [...picks].sort((a, b) => a.overall_pick - b.overall_pick);
        const positionCounts: Record<string, number> = {};
        for (const p of picks) {
          const pos = p.position || 'Unknown';
          positionCounts[pos] = (positionCounts[pos] || 0) + 1;
        }
        return {
          memberSeasonId: msId,
          teamName: memberNames[msId] || 'Unknown',
          picks: sortedPicks.map((p) => ({
            round: p.round,
            pick: p.pick_in_round,
            overall: p.overall_pick,
            playerName: p.player_name,
            position: p.position,
          })),
          positionCounts,
        };
      });

      return {
        boardId: board.id,
        leagueId: board.league_id,
        leagueName: league?.name || 'Unknown',
        leagueShortName: league?.short_name || '',
        leagueColor: league?.color || '#6b7280',
        status: board.status,
        totalPicks,
        picksMade,
        numRounds: board.num_rounds,
        currentPick,
        recentPicks,
        lastSyncedAt: board.last_synced_at,
        sleeperLinked: !!board.sleeper_draft_id,
        positionBreakdown,
        teamRosters,
      };
    });

    // Unified activity feed (expanded to 50)
    const recentActivity = (allPicks || []).slice(0, 50).map((p) => {
      const board = boards.find((b) => b.id === p.draft_board_id);
      const league = (leagues || []).find((l) => l.id === board?.league_id);
      return {
        playerName: p.player_name,
        teamName: memberNames[p.member_season_id] || 'Unknown',
        round: p.round,
        pick: p.pick_in_round,
        overall: p.overall_pick,
        position: p.position,
        timestamp: p.picked_at,
        leagueName: league?.name || 'Unknown',
        leagueShortName: league?.short_name || '',
        leagueColor: league?.color || '#6b7280',
        boardId: p.draft_board_id,
      };
    });

    return NextResponse.json({
      season,
      phase,
      drafts,
      recentActivity,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
