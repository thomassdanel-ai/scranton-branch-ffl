import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAuth, AuthError } from '@/lib/auth';
import { validateStatusTransition } from '@/lib/config';
import type { SeasonStatusValue } from '@/config/constants';

// POST: Advance season to next phase
export async function POST(req: NextRequest) {
  try {
    await requireAuth();

    const body = await req.json();
    const { seasonId, targetStatus } = body as { seasonId: string; targetStatus: SeasonStatusValue };

    if (!seasonId || !targetStatus) {
      return NextResponse.json({ error: 'Missing seasonId or targetStatus' }, { status: 400 });
    }

    const supabase = createServiceClient();

    const { data: season } = await supabase
      .from('seasons')
      .select('id, status')
      .eq('id', seasonId)
      .single();

    if (!season) {
      return NextResponse.json({ error: 'Season not found' }, { status: 404 });
    }

    try {
      validateStatusTransition(season.status as SeasonStatusValue, targetStatus);
    } catch (err) {
      return NextResponse.json({ error: (err as Error).message }, { status: 400 });
    }

    const { error } = await supabase
      .from('seasons')
      .update({ status: targetStatus, updated_at: new Date().toISOString() })
      .eq('id', seasonId);

    if (error) {
      return NextResponse.json({ error: 'Failed to update season' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, status: targetStatus });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
