import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getDraftPicks } from '@/lib/sleeper/api';
import { resolveMemberSeasonsBatch } from '@/lib/member-resolver';
import { isCronAuthorized } from '@/lib/cron-auth';
import type { SleeperDraftPick } from '@/lib/sleeper/types';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = createServiceClient();

    // Find active draft boards linked to Sleeper
    const { data: boards } = await supabase
      .from('draft_boards')
      .select('id, league_id, season_id, sleeper_draft_id, num_rounds, is_mock')
      .in('status', ['active', 'paused', 'drafting', 'pending'])
      .not('sleeper_draft_id', 'is', null);

    if (!boards || boards.length === 0) {
      return NextResponse.json({ skipped: true, reason: 'No active Sleeper-linked draft boards' });
    }

    const results: Record<string, { synced: number; total: number; completed: boolean }> = {};

    for (const board of boards) {
      try {
        // Fetch picks from Sleeper
        const sleeperPicks: SleeperDraftPick[] = await getDraftPicks(board.sleeper_draft_id);

        if (!sleeperPicks || sleeperPicks.length === 0) {
          results[board.id] = { synced: 0, total: 0, completed: false };
          continue;
        }

        // Get league info for member resolution
        const { data: league } = await supabase
          .from('leagues')
          .select('sleeper_league_id')
          .eq('id', board.league_id)
          .single();

        if (!league?.sleeper_league_id) {
          results[board.id] = { synced: 0, total: sleeperPicks.length, completed: false };
          continue;
        }

        // Batch resolve roster_id -> member_season_id
        const msMap = await resolveMemberSeasonsBatch(board.season_id, league.sleeper_league_id);

        // Get roster size for this league
        const { count: rosterSize } = await supabase
          .from('member_seasons')
          .select('id', { count: 'exact', head: true })
          .eq('league_id', board.league_id)
          .eq('season_id', board.season_id);

        const teamCount = rosterSize || 0;

        // Map Sleeper picks to our draft_picks rows
        const pickRows = sleeperPicks.map((sp) => {
          const sleeperPickId = `${board.sleeper_draft_id}-${sp.pick_no}`;
          const memberSeasonId = msMap.get(sp.roster_id) || null;
          const playerName = sp.metadata
            ? `${sp.metadata.first_name} ${sp.metadata.last_name}`
            : `Player ${sp.player_id}`;
          const position = sp.metadata?.position || null;

          return {
            draft_board_id: board.id,
            sleeper_pick_id: sleeperPickId,
            member_season_id: memberSeasonId,
            round: sp.round,
            pick_in_round: teamCount > 0 ? ((sp.pick_no - 1) % teamCount) + 1 : sp.pick_no,
            overall_pick: sp.pick_no,
            player_name: playerName,
            player_id: sp.player_id,
            position,
            picked_at: new Date().toISOString(),
          };
        });

        // Upsert picks (dedup on sleeper_pick_id)
        if (pickRows.length > 0) {
          const { error } = await supabase
            .from('draft_picks')
            .upsert(pickRows, { onConflict: 'sleeper_pick_id' });

          if (error) {
            console.error(`Draft sync upsert error for board ${board.id}:`, error);
          }
        }

        // Calculate total expected picks
        const totalExpected = board.num_rounds * teamCount;
        const isComplete = sleeperPicks.length >= totalExpected && totalExpected > 0;

        // Update board status and sync timestamp
        const boardUpdate: Record<string, unknown> = {
          last_synced_at: new Date().toISOString(),
        };

        // If picks exist and board is pending, mark as active
        if (sleeperPicks.length > 0 && board.is_mock === false) {
          const { data: currentBoard } = await supabase
            .from('draft_boards')
            .select('status')
            .eq('id', board.id)
            .single();

          if (currentBoard?.status === 'pending') {
            boardUpdate.status = 'drafting';
            boardUpdate.started_at = new Date().toISOString();
          }
        }

        // Update current round/pick based on latest Sleeper pick
        if (sleeperPicks.length > 0 && teamCount > 0) {
          const lastPick = sleeperPicks[sleeperPicks.length - 1];
          const nextPickNo = lastPick.pick_no + 1;
          const nextRound = Math.ceil(nextPickNo / teamCount);
          const nextPick = ((nextPickNo - 1) % teamCount) + 1;

          if (!isComplete) {
            boardUpdate.current_round = nextRound;
            boardUpdate.current_pick = nextPick;
          }
        }

        if (isComplete) {
          boardUpdate.status = 'completed';
          boardUpdate.completed_at = new Date().toISOString();
        }

        await supabase
          .from('draft_boards')
          .update(boardUpdate)
          .eq('id', board.id);

        // If all boards for this season are completed, advance season
        if (isComplete) {
          const { data: allBoards } = await supabase
            .from('draft_boards')
            .select('id, status')
            .eq('season_id', board.season_id)
            .eq('is_mock', false);

          const allDone = allBoards?.every((b) => b.status === 'completed' || b.id === board.id);
          if (allDone) {
            await supabase
              .from('seasons')
              .update({ status: 'active', updated_at: new Date().toISOString() })
              .eq('id', board.season_id);
          }
        }

        results[board.id] = {
          synced: pickRows.length,
          total: totalExpected,
          completed: isComplete,
        };
      } catch (err) {
        console.error(`Draft sync failed for board ${board.id}:`, err);
        results[board.id] = { synced: 0, total: 0, completed: false };
      }
    }

    return NextResponse.json({ synced: true, boards: results });
  } catch (err) {
    console.error('Draft sync cron error:', err);
    return NextResponse.json({ error: 'Draft sync failed' }, { status: 500 });
  }
}
