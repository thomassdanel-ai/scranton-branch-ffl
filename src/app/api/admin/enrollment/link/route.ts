import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAuth, AuthError } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    await requireAuth();
    const supabase = createServiceClient();
    const { leagueId, sleeperLeagueId, sleeperInviteLink } = await req.json();

    if (!leagueId) {
      return NextResponse.json({ error: 'leagueId required' }, { status: 400 });
    }

    // Extract numeric league ID from URL or raw value
    let cleanLeagueId = sleeperLeagueId?.toString().trim() ?? '';
    const urlMatch = cleanLeagueId.match(/sleeper\.com\/leagues\/(\d+)/);
    if (urlMatch) {
      cleanLeagueId = urlMatch[1];
    }
    if (cleanLeagueId && !/^\d+$/.test(cleanLeagueId)) {
      return NextResponse.json({ error: 'Invalid Sleeper league ID' }, { status: 400 });
    }

    // Validate invite link format if provided
    const cleanInviteLink = sleeperInviteLink?.toString().trim() || null;

    const updates: Record<string, string | null> = {};
    if (cleanLeagueId) updates.sleeper_league_id = cleanLeagueId;
    if (cleanInviteLink) updates.sleeper_invite_link = cleanInviteLink;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Provide at least sleeperLeagueId or sleeperInviteLink' }, { status: 400 });
    }

    const { error } = await supabase
      .from('leagues')
      .update(updates)
      .eq('id', leagueId);

    if (error) {
      return NextResponse.json({ error: 'Failed to update league' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
