import { NextRequest, NextResponse } from 'next/server';
import { loadBracket, saveBracket } from '@/lib/bracket/engine';
import type { BracketData } from '@/lib/bracket/engine';
import { requireAuth, AuthError } from '@/lib/auth';

export async function GET() {
  try {
    await requireAuth();

    const bracket = await loadBracket();
    return NextResponse.json({ bracket });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}

export async function PUT(req: NextRequest) {
  try {
    await requireAuth();

    const body = await req.json();
    const bracket = body.bracket as BracketData;

    if (!bracket) {
      return NextResponse.json({ error: 'Missing bracket data' }, { status: 400 });
    }

    await saveBracket(bracket);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
