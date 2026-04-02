import { NextRequest, NextResponse } from 'next/server';
import { getMatchups } from '@/lib/sleeper/api';
import { requireAuth, AuthError } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    await requireAuth();

    const body = await req.json();
    const { leagueId, week } = body as { leagueId: string; week: number };

    if (!leagueId || !week || !/^\d+$/.test(leagueId) || typeof week !== 'number' || week < 1 || week > 18) {
      return NextResponse.json({ error: 'Invalid leagueId or week' }, { status: 400 });
    }

    const matchups = await getMatchups(leagueId, week);

    const scores: Record<number, number> = {};
    for (const m of matchups) {
      scores[m.roster_id] = m.points;
    }

    return NextResponse.json({ scores });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('Score fetch error:', err);
    return NextResponse.json({ error: 'Failed to fetch scores' }, { status: 500 });
  }
}
