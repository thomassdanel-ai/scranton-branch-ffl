import { NextRequest, NextResponse } from 'next/server';
import { generateBracketMatchups } from '@/lib/bracket/engine';
import { isAuthed } from '@/lib/auth';

export async function POST(req: NextRequest) {
  if (!isAuthed()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { teamCount } = await req.json();
  if (!teamCount || teamCount < 2) {
    return NextResponse.json({ error: 'Invalid team count' }, { status: 400 });
  }

  const matchups = generateBracketMatchups(teamCount);
  return NextResponse.json({ matchups });
}
