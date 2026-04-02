import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAuth, AuthError } from '@/lib/auth';

// POST: Activate members who have confirmed/promoted registrations for a season
export async function POST(req: NextRequest) {
  try {
    await requireAuth();

    const body = await req.json();
    const { seasonId } = body as { seasonId: string };

    if (!seasonId) {
      return NextResponse.json({ error: 'Missing seasonId' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Verify season exists and is in a valid setup phase
    const { data: season } = await supabase
      .from('seasons')
      .select('id, status')
      .eq('id', seasonId)
      .single();

    if (!season || !['setup', 'registering', 'confirming'].includes(season.status)) {
      return NextResponse.json({ error: 'Season is not in a setup phase' }, { status: 400 });
    }

    // Query all confirmed/promoted registrations for this season
    const { data: registrations } = await supabase
      .from('season_registrations')
      .select('member_id')
      .eq('season_id', seasonId)
      .in('status', ['confirmed', 'promoted']);

    if (!registrations || registrations.length === 0) {
      return NextResponse.json({ ok: true, activatedCount: 0 });
    }

    // Ensure each confirmed member has active status
    let activatedCount = 0;
    for (const reg of registrations) {
      const { data: updated } = await supabase
        .from('members')
        .update({ status: 'active', updated_at: new Date().toISOString() })
        .eq('id', reg.member_id)
        .neq('status', 'active')
        .select('id');

      if (updated && updated.length > 0) {
        activatedCount++;
      }
    }

    return NextResponse.json({ ok: true, activatedCount });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
