import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getSeasonLeagues } from '@/lib/config';
import { requireAuth, AuthError } from '@/lib/auth';

export async function GET() {
  try {
    await requireAuth();

    const supabase = createServiceClient();

    const { data } = await supabase
      .from('seasons')
      .select('*')
      .in('status', ['active', 'drafting', 'pre_draft', 'setup'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    const leagues = data ? await getSeasonLeagues(data.id) : [];
    return NextResponse.json({
      season: data,
      leagues,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}

export async function PUT(req: NextRequest) {
  try {
    await requireAuth();

    const body = await req.json();
    const { year, config } = body;

    if (!year || !config) {
      return NextResponse.json({ error: 'Missing year or config' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Upsert the season
    const { data, error } = await supabase
      .from('seasons')
      .upsert(
        { year, config },
        { onConflict: 'year' }
      )
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ season: data });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
