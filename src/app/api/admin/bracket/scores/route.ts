import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getMatchups } from '@/lib/sleeper/api';

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  if (cookieStore.get('admin_auth')?.value !== 'true') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { leagueId, week } = body as { leagueId: string; week: number };

  if (!leagueId || !week || !/^\d+$/.test(leagueId) || typeof week !== 'number' || week < 1 || week > 18) {
    return NextResponse.json({ error: 'Invalid leagueId or week' }, { status: 400 });
  }

  try {
    const matchups = await getMatchups(leagueId, week);

    const scores: Record<number, number> = {};
    for (const m of matchups) {
      scores[m.roster_id] = m.points;
    }

    return NextResponse.json({ scores });
  } catch (err) {
    console.error('Score fetch error:', err);
    return NextResponse.json({ error: 'Failed to fetch scores' }, { status: 500 });
  }
}
