import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

// GET: Public endpoint to fetch a draft board (for viewers)
export async function GET(req: NextRequest) {
  const boardId = req.nextUrl.searchParams.get('boardId');
  if (!boardId) {
    return NextResponse.json({ error: 'Missing boardId' }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: board } = await supabase
    .from('draft_boards')
    .select('id, league_id, season_id, status, num_rounds, current_round, current_pick, seconds_per_pick, is_mock, started_at, completed_at')
    .eq('id', boardId)
    .single();

  if (!board) {
    return NextResponse.json({ error: 'Board not found' }, { status: 404 });
  }

  const { data: league } = await supabase
    .from('leagues')
    .select('name')
    .eq('id', board.league_id)
    .single();

  const { data: picks } = await supabase
    .from('draft_picks')
    .select('id, member_season_id, round, pick_in_round, overall_pick, player_name, position, picked_at')
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
    leagueName: league?.name || 'Unknown',
    picks: picks || [],
    memberSeasons: memberSeasons || [],
    members: members || [],
  });
}
