import { NextRequest, NextResponse } from 'next/server';
import { generateBracketMatchups } from '@/lib/bracket/engine';
import { requireAuth, AuthError } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    await requireAuth();

    const { teamCount } = await req.json();
    if (!teamCount || teamCount < 2) {
      return NextResponse.json({ error: 'Invalid team count' }, { status: 400 });
    }

    const matchups = generateBracketMatchups(teamCount);
    return NextResponse.json({ matchups });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
