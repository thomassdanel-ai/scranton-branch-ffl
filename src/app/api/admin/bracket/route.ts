import { NextRequest, NextResponse } from 'next/server';
import { loadBracket, saveBracket } from '@/lib/bracket/engine';
import { BracketDataSchema } from '@/lib/bracket/schema';
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

    const result = BracketDataSchema.safeParse(body.bracket);
    if (!result.success) {
      const errors = result.error.issues.map(
        (i) => `${i.path.join('.')}: ${i.message}`
      );
      return NextResponse.json(
        { error: 'Invalid bracket data', details: errors },
        { status: 400 }
      );
    }

    await saveBracket(result.data);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
