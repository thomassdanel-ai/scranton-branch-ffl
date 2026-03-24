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

  if (!leagueId || !week) {
    return NextResponse.json({ error: 'leagueId and week are required' }, { status: 400 });
  }

  try {
    const matchups = await getMatchups(leagueId, week);

    const scores: Record<number, number> = {};
    for (const m of matchups) {
      scores[m.roster_id] = m.points;
    }

    return NextResponse.json({ scores });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: `Failed to fetch scores: ${message}` }, { status: 500 });
  }
}
