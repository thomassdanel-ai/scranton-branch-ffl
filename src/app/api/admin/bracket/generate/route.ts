import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { generateBracketMatchups } from '@/lib/bracket/engine';
import { requireAuth, AuthError } from '@/lib/auth';

const GenerateSchema = z.object({
  teamCount: z.number().int().min(2).max(16),
});

export async function POST(req: NextRequest) {
  try {
    await requireAuth();

    const body = await req.json();
    const result = GenerateSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid team count', details: result.error.issues },
        { status: 400 }
      );
    }

    const matchups = generateBracketMatchups(result.data.teamCount);
    return NextResponse.json({ matchups });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
