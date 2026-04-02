import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAuth, AuthError } from '@/lib/auth';

export async function GET() {
  try {
    await requireAuth();
    const supabase = createServiceClient();

    // Find the drafting/active season
    const { data: season } = await supabase
      .from('seasons')
      .select('id, season_number, year, status')
      .in('status', ['drafting', 'active', 'pre_draft'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!season) {
      return NextResponse.json({ season: null, drafts: [], recentActivity: [] });
    }

    // Fetch all draft boards for this season (non-mock)
    const { data: boards } = await supabase
      .from('draft_boards')
      .select('id, league_id, status, num_rounds, current_round, current_pick, sleeper_draft_id, last_synced_at, is_mock, started_at, completed_at')
      .eq('season_id', season.id)
      .eq('is_mock', false);

    if (!boards || boards.length === 0) {
      return NextResponse.json({ season, drafts: [], recentActivity: [] });
    }

    // Fetch leagues
    const leagueIds = boards.map((b) => b.league_id);
    const { data: leagues } = await supabase
      .from('leagues')
      .select('id, name, short_name, color')
      .in('id', leagueIds);

    // Fetch all picks for active boards
    const boardIds = boards.map((b) => b.id);
    const { data: allPicks } = await supabase
      .from('draft_picks')
      .select('id, draft_board_id, member_season_id, round, pick_in_round, overall_pick, player_name, position, picked_at')
      .in('draft_board_id', boardIds)
      .not('player_name', 'is', null)
      .order('picked_at', { ascending: false })
      .limit(200);

    // Fetch member_seasons and members for name resolution
    const msIds = Array.from(new Set((allPicks || []).map((p) => p.member_season_id).filter(Boolean)));
    let memberNames: Record<string, string> = {};

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
    for (const ms of (memberSeasonCounts || [])) {
      rosterSizes[ms.league_id] = (rosterSizes[ms.league_id] || 0) + 1;
    }

    // Build draft summaries
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
          };
        } else {
          currentPick = {
            round: board.current_round,
            pick: board.current_pick,
            teamName: 'TBD',
          };
        }
      }

      // Recent picks (last 3)
      const recentPicks = boardPicks.slice(0, 3).map((p) => ({
        playerName: p.player_name,
        teamName: memberNames[p.member_season_id] || 'Unknown',
        round: p.round,
        pick: p.pick_in_round,
        timestamp: p.picked_at,
        position: p.position,
      }));

      return {
        boardId: board.id,
        leagueId: board.league_id,
        leagueName: league?.name || 'Unknown',
        leagueShortName: league?.short_name || '',
        leagueColor: league?.color || '#6b7280',
        status: board.status,
        totalPicks,
        picksMade,
        currentPick,
        recentPicks,
        lastSyncedAt: board.last_synced_at,
        sleeperLinked: !!board.sleeper_draft_id,
      };
    });

    // Unified activity feed (last 20 picks across all boards)
    const recentActivity = (allPicks || []).slice(0, 20).map((p) => {
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
        leagueColor: league?.color || '#6b7280',
      };
    });

    return NextResponse.json({
      season,
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
