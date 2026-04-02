import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getDraftPicks } from '@/lib/sleeper/api';
import { resolveMemberSeasonsBatch } from '@/lib/member-resolver';
import { requireAuth, AuthError } from '@/lib/auth';
import type { SleeperDraftPick } from '@/lib/sleeper/types';

// POST: One-shot sync for a single draft board (commissioner triggers manually)
export async function POST(req: NextRequest) {
  try {
    await requireAuth();

    const body = await req.json();
    const { boardId } = body as { boardId: string };

    if (!boardId) {
      return NextResponse.json({ error: 'Missing boardId' }, { status: 400 });
    }

    const supabase = createServiceClient();

    const { data: board } = await supabase
      .from('draft_boards')
      .select('id, league_id, season_id, sleeper_draft_id, num_rounds, status')
      .eq('id', boardId)
      .single();

    if (!board) {
      return NextResponse.json({ error: 'Board not found' }, { status: 404 });
    }

    if (!board.sleeper_draft_id) {
      return NextResponse.json({ error: 'Board not linked to Sleeper draft' }, { status: 400 });
    }

    // Fetch picks from Sleeper
    const sleeperPicks: SleeperDraftPick[] = await getDraftPicks(board.sleeper_draft_id);

    if (!sleeperPicks || sleeperPicks.length === 0) {
      await supabase
        .from('draft_boards')
        .update({ last_synced_at: new Date().toISOString() })
        .eq('id', boardId);
      return NextResponse.json({ synced: 0, total: 0 });
    }

    // Get league info
    const { data: league } = await supabase
      .from('leagues')
      .select('sleeper_league_id')
      .eq('id', board.league_id)
      .single();

    if (!league?.sleeper_league_id) {
      return NextResponse.json({ error: 'League not linked to Sleeper' }, { status: 400 });
    }

    const msMap = await resolveMemberSeasonsBatch(board.season_id, league.sleeper_league_id);

    const { count: rosterSize } = await supabase
      .from('member_seasons')
      .select('id', { count: 'exact', head: true })
      .eq('league_id', board.league_id)
      .eq('season_id', board.season_id);

    const teamCount = rosterSize || 0;

    const pickRows = sleeperPicks.map((sp) => ({
      draft_board_id: board.id,
      sleeper_pick_id: `${board.sleeper_draft_id}-${sp.pick_no}`,
      member_season_id: msMap.get(sp.roster_id) || null,
      round: sp.round,
      pick_in_round: teamCount > 0 ? ((sp.pick_no - 1) % teamCount) + 1 : sp.pick_no,
      overall_pick: sp.pick_no,
      player_name: sp.metadata
        ? `${sp.metadata.first_name} ${sp.metadata.last_name}`
        : `Player ${sp.player_id}`,
      player_id: sp.player_id,
      position: sp.metadata?.position || null,
      picked_at: new Date().toISOString(),
    }));

    if (pickRows.length > 0) {
      const { error } = await supabase
        .from('draft_picks')
        .upsert(pickRows, { onConflict: 'sleeper_pick_id' });

      if (error) {
        return NextResponse.json({ error: `Upsert failed: ${error.message}` }, { status: 500 });
      }
    }

    const totalExpected = board.num_rounds * teamCount;
    const isComplete = sleeperPicks.length >= totalExpected && totalExpected > 0;

    const boardUpdate: Record<string, unknown> = {
      last_synced_at: new Date().toISOString(),
    };

    if (sleeperPicks.length > 0 && board.status === 'pending') {
      boardUpdate.status = 'drafting';
      boardUpdate.started_at = new Date().toISOString();
    }

    if (sleeperPicks.length > 0 && teamCount > 0) {
      const lastPick = sleeperPicks[sleeperPicks.length - 1];
      const nextPickNo = lastPick.pick_no + 1;
      boardUpdate.current_round = Math.ceil(nextPickNo / teamCount);
      boardUpdate.current_pick = ((nextPickNo - 1) % teamCount) + 1;
    }

    if (isComplete) {
      boardUpdate.status = 'completed';
      boardUpdate.completed_at = new Date().toISOString();
    }

    await supabase
      .from('draft_boards')
      .update(boardUpdate)
      .eq('id', boardId);

    return NextResponse.json({
      synced: pickRows.length,
      total: totalExpected,
      completed: isComplete,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
