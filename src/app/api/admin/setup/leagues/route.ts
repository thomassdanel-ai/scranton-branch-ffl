import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAuth, AuthError } from '@/lib/auth';

// Fisher-Yates shuffle
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

// POST: Randomize or lock league assignments
export async function POST(req: NextRequest) {
  try {
    await requireAuth();

    const body = await req.json();
  const { seasonId, action, assignments } = body as {
    seasonId: string;
    action: 'randomize' | 'lock' | 'manual';
    assignments?: Record<string, string>; // memberId -> leagueId (for manual/lock)
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

  if (!season || season.status !== 'setup') {
    return NextResponse.json({ error: 'Season is not in setup phase' }, { status: 400 });
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
    // Get confirmed/active members
    const { data: members } = await supabase
      .from('members')
      .select('id')
      .eq('org_id', season.org_id)
      .eq('status', 'active');

    if (!members || members.length === 0) {
      return NextResponse.json({ error: 'No active members to randomize' }, { status: 400 });
    }

    // Shuffle and round-robin into leagues
    const shuffled = shuffle(members);
    const result: Record<string, string> = {};
    for (let i = 0; i < shuffled.length; i++) {
      const league = leagues[i % leagues.length];
      result[shuffled[i].id] = league.id;
    }

    return NextResponse.json({ assignments: result });
  }

  if (action === 'lock') {
    if (!assignments || Object.keys(assignments).length === 0) {
      return NextResponse.json({ error: 'No assignments to lock' }, { status: 400 });
    }

    // Clear any existing member_seasons for this season
    await supabase.from('member_seasons').delete().eq('season_id', seasonId);

    // Create member_seasons rows
    const rows = Object.keys(assignments).map((memberId) => ({
      member_id: memberId,
      season_id: seasonId,
      league_id: assignments[memberId],
      onboard_status: 'confirmed',
    }));

    const { error } = await supabase.from('member_seasons').insert(rows);
    if (error) {
      return NextResponse.json({ error: 'Failed to lock league assignments' }, { status: 500 });
    }

    // Update season status to pre_draft
    await supabase
      .from('seasons')
      .update({ status: 'pre_draft', updated_at: new Date().toISOString() })
      .eq('id', seasonId);

    return NextResponse.json({ ok: true, status: 'pre_draft' });
  }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
