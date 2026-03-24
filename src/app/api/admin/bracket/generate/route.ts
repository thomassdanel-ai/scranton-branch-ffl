import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { generateBracketMatchups } from '@/lib/bracket/engine';

function isAuthed(): boolean {
  const cookieStore = cookies();
  return cookieStore.get('admin_auth')?.value === 'true';
}

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
