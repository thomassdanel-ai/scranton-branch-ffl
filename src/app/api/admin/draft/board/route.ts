import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAuth, AuthError } from '@/lib/auth';

// GET: Fetch a single draft board with all picks
export async function GET(req: NextRequest) {
  try {
    await requireAuth();

    const boardId = req.nextUrl.searchParams.get('boardId');
  if (!boardId) {
    return NextResponse.json({ error: 'Missing boardId' }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: board } = await supabase
    .from('draft_boards')
    .select('*')
    .eq('id', boardId)
    .single();

  if (!board) {
    return NextResponse.json({ error: 'Board not found' }, { status: 404 });
  }

  const { data: picks } = await supabase
    .from('draft_picks')
    .select('*')
    .eq('draft_board_id', boardId)
    .order('overall_pick');

  const { data: memberSeasons } = await supabase
    .from('member_seasons')
    .select('id, member_id, draft_position')
    .eq('league_id', board.league_id)
    .eq('season_id', board.season_id)
    .order('draft_position');

  const msIds = (memberSeasons || []).map((ms: { member_id: string }) => ms.member_id);
  const { data: members } = await supabase
    .from('members')
    .select('id, full_name, display_name')
    .in('id', msIds.length > 0 ? msIds : ['_none_']);

    return NextResponse.json({
      board,
      picks: picks || [],
      memberSeasons: memberSeasons || [],
      members: members || [],
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}

// POST: Actions on a draft board (start, pick, pause, resume, complete, reset-mock)
export async function POST(req: NextRequest) {
  try {
    await requireAuth();

    const body = await req.json();
  const { boardId, action } = body as {
    boardId: string;
    action: 'start' | 'pick' | 'pause' | 'resume' | 'complete' | 'reset-mock';
  };

  if (!boardId || !action) {
    return NextResponse.json({ error: 'Missing boardId or action' }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: board } = await supabase
    .from('draft_boards')
    .select('*')
    .eq('id', boardId)
    .single();

  if (!board) {
    return NextResponse.json({ error: 'Board not found' }, { status: 404 });
  }

  if (action === 'start') {
    if (board.status !== 'pending') {
      return NextResponse.json({ error: 'Board is not in pending status' }, { status: 400 });
    }

    const { error } = await supabase
      .from('draft_boards')
      .update({
        status: 'drafting',
        current_round: 1,
        current_pick: 1,
        started_at: new Date().toISOString(),
      })
      .eq('id', boardId);

    if (error) {
      return NextResponse.json({ error: 'Failed to start draft' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, status: 'drafting' });
  }

  if (action === 'pick') {
    if (board.status !== 'drafting') {
      return NextResponse.json({ error: 'Draft is not active' }, { status: 400 });
    }

    const { pickId, playerName, position, playerId } = body as {
      pickId: string;
      playerName: string;
      position: string;
      playerId?: string;
    };

    if (!pickId || !playerName || !position) {
      return NextResponse.json({ error: 'Missing pick data' }, { status: 400 });
    }

    // Verify this pick belongs to this board and is the current pick
    const { data: pick } = await supabase
      .from('draft_picks')
      .select('*')
      .eq('id', pickId)
      .eq('draft_board_id', boardId)
      .single();

    if (!pick) {
      return NextResponse.json({ error: 'Pick not found' }, { status: 404 });
    }

    if (pick.round !== board.current_round || pick.pick_in_round !== board.current_pick) {
      return NextResponse.json({ error: 'Not the current pick' }, { status: 400 });
    }

    if (pick.player_name) {
      return NextResponse.json({ error: 'Pick already made' }, { status: 400 });
    }

    // Record the pick
    const { error: pickErr } = await supabase
      .from('draft_picks')
      .update({
        player_name: playerName.trim(),
        position: position.trim().toUpperCase(),
        player_id: playerId || null,
        picked_at: new Date().toISOString(),
      })
      .eq('id', pickId);

    if (pickErr) {
      return NextResponse.json({ error: 'Failed to record pick' }, { status: 500 });
    }

    // Count roster size to figure out if we need to advance round
    const { count } = await supabase
      .from('member_seasons')
      .select('id', { count: 'exact', head: true })
      .eq('league_id', board.league_id)
      .eq('season_id', board.season_id);

    const rosterSize = count || 0;
    let nextRound = board.current_round;
    let nextPick = board.current_pick + 1;

    if (nextPick > rosterSize) {
      nextRound = board.current_round + 1;
      nextPick = 1;
    }

    const isComplete = nextRound > board.num_rounds;

    if (isComplete) {
      await supabase
        .from('draft_boards')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', boardId);
    } else {
      await supabase
        .from('draft_boards')
        .update({
          current_round: nextRound,
          current_pick: nextPick,
        })
        .eq('id', boardId);
    }

    return NextResponse.json({
      ok: true,
      completed: isComplete,
      currentRound: isComplete ? board.num_rounds : nextRound,
      currentPick: isComplete ? rosterSize : nextPick,
    });
  }

  if (action === 'pause') {
    if (board.status !== 'drafting') {
      return NextResponse.json({ error: 'Draft is not active' }, { status: 400 });
    }

    await supabase
      .from('draft_boards')
      .update({ status: 'paused' })
      .eq('id', boardId);

    return NextResponse.json({ ok: true, status: 'paused' });
  }

  if (action === 'resume') {
    if (board.status !== 'paused') {
      return NextResponse.json({ error: 'Draft is not paused' }, { status: 400 });
    }

    await supabase
      .from('draft_boards')
      .update({ status: 'drafting' })
      .eq('id', boardId);

    return NextResponse.json({ ok: true, status: 'drafting' });
  }

  if (action === 'complete') {
    await supabase
      .from('draft_boards')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', boardId);

    // Check if all boards for this season are completed
    const { data: allBoards } = await supabase
      .from('draft_boards')
      .select('id, status, season_id')
      .eq('season_id', board.season_id);

    const allDone = allBoards?.every((b: { status: string }) => b.status === 'completed');

    if (allDone) {
      await supabase
        .from('seasons')
        .update({ status: 'active', updated_at: new Date().toISOString() })
        .eq('id', board.season_id);
    }

    return NextResponse.json({ ok: true, status: 'completed', seasonActive: allDone });
  }

  if (action === 'reset-mock') {
    if (!board.is_mock) {
      return NextResponse.json({ error: 'Cannot reset a non-mock draft' }, { status: 400 });
    }

    // Clear all picks but keep the slots
    await supabase
      .from('draft_picks')
      .update({
        player_name: null,
        player_id: null,
        position: null,
        picked_at: null,
      })
      .eq('draft_board_id', boardId);

    await supabase
      .from('draft_boards')
      .update({
        status: 'pending',
        current_round: 1,
        current_pick: 1,
        started_at: null,
        completed_at: null,
      })
      .eq('id', boardId);

    return NextResponse.json({ ok: true, status: 'pending' });
  }

  if (action === 'link-sleeper') {
    const { sleeperDraftId } = body as { sleeperDraftId: string };
    if (!sleeperDraftId) {
      return NextResponse.json({ error: 'Missing sleeperDraftId' }, { status: 400 });
    }

    const { error: linkErr } = await supabase
      .from('draft_boards')
      .update({ sleeper_draft_id: sleeperDraftId })
      .eq('id', boardId);

    if (linkErr) {
      return NextResponse.json({ error: 'Failed to link Sleeper draft' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, sleeperDraftId });
  }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
