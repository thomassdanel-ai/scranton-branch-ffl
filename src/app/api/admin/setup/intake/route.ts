import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { isAuthed } from '@/lib/auth';

// POST: Update member onboard statuses for the current setup season
export async function POST(req: NextRequest) {
  if (!isAuthed()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { seasonId, confirmations } = body as {
    seasonId: string;
    confirmations: Record<string, 'confirmed' | 'declined' | 'pending'>;
  };

  if (!seasonId || !confirmations) {
    return NextResponse.json({ error: 'Missing seasonId or confirmations' }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Verify season is in setup status
  const { data: season } = await supabase
    .from('seasons')
    .select('id, status')
    .eq('id', seasonId)
    .single();

  if (!season || season.status !== 'setup') {
    return NextResponse.json({ error: 'Season is not in setup phase' }, { status: 400 });
  }

  // Update member statuses — set inactive members who declined
  const memberIds = Object.keys(confirmations);
  for (const memberId of memberIds) {
    const status = confirmations[memberId];
    if (status === 'declined') {
      await supabase
        .from('members')
        .update({ status: 'inactive', updated_at: new Date().toISOString() })
        .eq('id', memberId);
    } else if (status === 'confirmed') {
      // Ensure they're active
      await supabase
        .from('members')
        .update({ status: 'active', updated_at: new Date().toISOString() })
        .eq('id', memberId);
    }
  }

  return NextResponse.json({ ok: true });
}
