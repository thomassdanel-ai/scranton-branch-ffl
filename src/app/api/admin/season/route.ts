import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServiceClient } from '@/lib/supabase/server';
import { LEAGUE_CONFIG } from '@/config/leagues';

function isAuthed(): boolean {
  const cookieStore = cookies();
  return cookieStore.get('admin_auth')?.value === 'true';
}

export async function GET() {
  if (!isAuthed()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();

  // Try status-based lookup first
  const { data: byStatus } = await supabase
    .from('seasons')
    .select('*')
    .in('status', ['active', 'drafting', 'pre_draft', 'setup'])
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  const data = byStatus || (await supabase
    .from('seasons')
    .select('*')
    .eq('is_current', true)
    .single()).data;

  return NextResponse.json({
    season: data,
    fallbackConfig: LEAGUE_CONFIG,
  });
}

export async function PUT(req: NextRequest) {
  if (!isAuthed()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { year, config } = body;

  if (!year || !config) {
    return NextResponse.json({ error: 'Missing year or config' }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Unset any existing current season
  await supabase
    .from('seasons')
    .update({ is_current: false })
    .eq('is_current', true);

  // Upsert the new current season
  const { data, error } = await supabase
    .from('seasons')
    .upsert(
      { year, is_current: true, config },
      { onConflict: 'year' }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ season: data });
}
