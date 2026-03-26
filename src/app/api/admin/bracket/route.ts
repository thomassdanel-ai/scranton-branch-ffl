import { NextRequest, NextResponse } from 'next/server';
import { loadBracket, saveBracket } from '@/lib/bracket/engine';
import type { BracketData } from '@/lib/bracket/engine';
import { isAuthed } from '@/lib/auth';

export async function GET() {
  if (!isAuthed()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const bracket = await loadBracket();
  return NextResponse.json({ bracket });
}

export async function PUT(req: NextRequest) {
  if (!isAuthed()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const bracket = body.bracket as BracketData;

  if (!bracket) {
    return NextResponse.json({ error: 'Missing bracket data' }, { status: 400 });
  }

  await saveBracket(bracket);
  return NextResponse.json({ ok: true });
}
