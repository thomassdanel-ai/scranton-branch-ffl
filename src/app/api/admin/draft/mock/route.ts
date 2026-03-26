import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { isAuthed } from '@/lib/auth';

// POST: Create a mock draft board for a league (copies the real board's structure)
export async function POST(req: NextRequest) {
  if (!isAuthed()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { leagueId, seasonId } = body as { leagueId: string; seasonId: string };

  if (!leagueId || !seasonId) {
    return NextResponse.json({ error: 'Missing leagueId or seasonId' }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Delete existing mock board for this league/season
  const { data: existingMock } = await supabase
    .from('draft_boards')
    .select('id')
    .eq('league_id', leagueId)
    .eq('season_id', seasonId)
    .eq('is_mock', true)
    .single();

  if (existingMock) {
    await supabase.from('draft_picks').delete().eq('draft_board_id', existingMock.id);
    await supabase.from('draft_boards').delete().eq('id', existingMock.id);
  }

  // Get member_seasons for this league to know roster size and draft order
  const { data: ms } = await supabase
    .from('member_seasons')
    .select('id, draft_position')
    .eq('season_id', seasonId)
    .eq('league_id', leagueId)
    .order('draft_position');

  if (!ms || ms.length === 0) {
    return NextResponse.json({ error: 'No members found for this league' }, { status: 400 });
  }

  const numRounds = 15;

  const { data: board, error: boardErr } = await supabase
    .from('draft_boards')
    .insert({
      league_id: leagueId,
      season_id: seasonId,
      status: 'pending',
      num_rounds: numRounds,
      is_mock: true,
    })
    .select()
    .single();

  if (boardErr || !board) {
    return NextResponse.json({ error: 'Failed to create mock board' }, { status: 500 });
  }

  // Generate snake draft picks (same logic as setup/draft lock)
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
    await supabase.from('draft_boards').delete().eq('id', board.id);
    return NextResponse.json({ error: 'Failed to generate mock picks' }, { status: 500 });
  }

  return NextResponse.json({ board }, { status: 201 });
}
