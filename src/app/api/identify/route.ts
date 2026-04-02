import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { getActiveSeasonId } from '@/lib/config';

const MEMBER_COOKIE = 'member_id';
const COOKIE_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

// POST: Look up member by email and set identity cookie
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email } = body as { email: string };

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Find member by email
    const { data: member } = await supabase
      .from('members')
      .select('id, full_name, display_name')
      .eq('email', normalizedEmail)
      .single();

    if (!member) {
      return NextResponse.json({ error: 'No account found with that email' }, { status: 404 });
    }

    // Find their active season membership
    const seasonId = await getActiveSeasonId();
    if (!seasonId) {
      return NextResponse.json({ error: 'No active season' }, { status: 404 });
    }

    const { data: memberSeason } = await supabase
      .from('member_seasons')
      .select('id, league_id')
      .eq('member_id', member.id)
      .eq('season_id', seasonId)
      .single();

    if (!memberSeason) {
      return NextResponse.json({ error: 'You are not assigned to a league this season' }, { status: 404 });
    }

    // Get league info
    const { data: league } = await supabase
      .from('leagues')
      .select('id, name, cohort_id')
      .eq('id', memberSeason.league_id)
      .single();

    // Set identity cookie
    const cookieStore = cookies();
    cookieStore.set(MEMBER_COOKIE, member.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: COOKIE_TTL_SECONDS,
      path: '/',
    });

    return NextResponse.json({
      memberId: member.id,
      memberName: member.display_name || member.full_name,
      memberSeasonId: memberSeason.id,
      leagueId: league?.id || memberSeason.league_id,
      leagueName: league?.name || 'Unknown',
      cohortId: league?.cohort_id || null,
    });
  } catch {
    return NextResponse.json({ error: 'Identification failed' }, { status: 500 });
  }
}

// DELETE: Clear identity cookie
export async function DELETE() {
  const cookieStore = cookies();
  cookieStore.set(MEMBER_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 0,
    path: '/',
  });

  return NextResponse.json({ ok: true });
}
