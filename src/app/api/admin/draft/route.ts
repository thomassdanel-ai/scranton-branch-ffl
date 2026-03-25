import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServiceClient } from '@/lib/supabase/server';

function isAuthed(): boolean {
  const cookieStore = cookies();
  return cookieStore.get('admin_auth')?.value === 'true';
}

// GET: Fetch draft boards for the current drafting season
export async function GET() {
  if (!isAuthed()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();

  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('slug', 'scranton-branch-ffl')
    .single();

  if (!org) {
    return NextResponse.json({ error: 'Org not found' }, { status: 500 });
  }

  // Find the season in drafting status
  const { data: season } = await supabase
    .from('seasons')
    .select('*')
    .eq('org_id', org.id)
    .eq('status', 'drafting')
    .limit(1)
    .single();

  if (!season) {
    return NextResponse.json({ season: null, boards: [], leagues: [], members: [], memberSeasons: [] });
  }

  const { data: leagues } = await supabase
    .from('leagues')
    .select('*')
    .eq('season_id', season.id)
    .order('name');

  const { data: boards } = await supabase
    .from('draft_boards')
    .select('*')
    .eq('season_id', season.id)
    .order('created_at');

  const { data: members } = await supabase
    .from('members')
    .select('id, full_name, display_name')
    .eq('org_id', org.id);

  const { data: memberSeasons } = await supabase
    .from('member_seasons')
    .select('*')
    .eq('season_id', season.id);

  return NextResponse.json({
    season,
    boards: boards || [],
    leagues: leagues || [],
    members: members || [],
    memberSeasons: memberSeasons || [],
  });
}
