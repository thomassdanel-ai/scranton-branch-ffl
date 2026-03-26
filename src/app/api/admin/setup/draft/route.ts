import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { isAuthed } from '@/lib/auth';

function shuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = result[i];
    result[i] = result[j];
    result[j] = temp;
  }
  return result;
}

// POST: Randomize or lock draft order
export async function POST(req: NextRequest) {
  if (!isAuthed()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { seasonId, action, draftOrders } = body as {
    seasonId: string;
    action: 'randomize' | 'lock';
    draftOrders?: Record<string, number>; // memberSeasonId -> position (for lock)
  };

  if (!seasonId || !action) {
    return NextResponse.json({ error: 'Missing seasonId or action' }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: season } = await supabase
    .from('seasons')
    .select('*')
    .eq('id', seasonId)
    .single();

  if (!season || season.status !== 'pre_draft') {
    return NextResponse.json({ error: 'Season is not in pre_draft phase' }, { status: 400 });
  }

  const { data: leagues } = await supabase
    .from('leagues')
    .select('id, name')
    .eq('season_id', seasonId)
    .order('name');

  if (!leagues || leagues.length === 0) {
    return NextResponse.json({ error: 'No leagues found' }, { status: 400 });
  }

  if (action === 'randomize') {
    const result: Record<string, number> = {};

    for (const league of leagues) {
      const { data: ms } = await supabase
        .from('member_seasons')
        .select('id')
        .eq('season_id', seasonId)
        .eq('league_id', league.id);

      if (!ms) continue;
      const shuffled = shuffle(ms);
      for (let i = 0; i < shuffled.length; i++) {
        result[shuffled[i].id] = i + 1;
      }
    }

    return NextResponse.json({ draftOrders: result });
  }

  if (action === 'lock') {
    if (!draftOrders || Object.keys(draftOrders).length === 0) {
      return NextResponse.json({ error: 'No draft orders to lock' }, { status: 400 });
    }

    // Update draft_position on each member_season
    for (const msId of Object.keys(draftOrders)) {
      await supabase
        .from('member_seasons')
        .update({ draft_position: draftOrders[msId] })
        .eq('id', msId);
    }

    // Pre-generate draft pick slots for each league
    const numRounds = 15; // default
    for (const league of leagues) {
      const { data: ms } = await supabase
        .from('member_seasons')
        .select('id, draft_position')
        .eq('season_id', seasonId)
        .eq('league_id', league.id)
        .order('draft_position');

      if (!ms || ms.length === 0) continue;

      // Create draft board
      const { data: board, error: boardErr } = await supabase
        .from('draft_boards')
        .upsert(
          {
            league_id: league.id,
            season_id: seasonId,
            status: 'pending',
            num_rounds: numRounds,
          },
          { onConflict: 'league_id,season_id' }
        )
        .select()
        .single();

      if (boardErr || !board) continue;

      // Clear existing picks for this board (in case of re-lock)
      await supabase.from('draft_picks').delete().eq('draft_board_id', board.id);

      // Generate snake draft picks
      const picks: Array<{
        draft_board_id: string;
        member_season_id: string;
        round: number;
        pick_in_round: number;
        overall_pick: number;
      }> = [];

      let overall = 1;
      for (let round = 1; round <= numRounds; round++) {
        const isEvenRound = round % 2 === 0;
        const order = isEvenRound ? [...ms].reverse() : ms;

        for (let pick = 0; pick < order.length; pick++) {
          picks.push({
            draft_board_id: board.id,
            member_season_id: order[pick].id,
            round,
            pick_in_round: pick + 1,
            overall_pick: overall,
          });
          overall++;
        }
      }

      const { error: pickErr } = await supabase.from('draft_picks').insert(picks);
      if (pickErr) {
        return NextResponse.json({ error: `Failed to generate picks for ${league.name}` }, { status: 500 });
      }
    }

    // Update season status to drafting
    await supabase
      .from('seasons')
      .update({ status: 'drafting', updated_at: new Date().toISOString() })
      .eq('id', seasonId);

    return NextResponse.json({ ok: true, status: 'drafting' });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
