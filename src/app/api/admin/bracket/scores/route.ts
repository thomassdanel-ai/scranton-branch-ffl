import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getMatchups } from '@/lib/sleeper/api';
import { requireAuth, AuthError } from '@/lib/auth';

const ScoresSchema = z.object({
  leagueId: z.string().regex(/^\d+$/, 'Must be a numeric Sleeper ID'),
  week: z.number().int().min(1).max(18),
});

export async function POST(req: NextRequest) {
  try {
    await requireAuth();

    const body = await req.json();
    const result = ScoresSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid leagueId or week', details: result.error.issues },
        { status: 400 }
      );
    }

    const { leagueId, week } = result.data;

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
