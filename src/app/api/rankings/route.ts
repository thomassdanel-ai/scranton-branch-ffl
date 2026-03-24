import { NextResponse } from 'next/server';
import { computePowerRankings } from '@/lib/rankings/compute';

export const revalidate = 300; // 5 min ISR

export async function GET() {
  try {
    const rankings = await computePowerRankings();
    return NextResponse.json({ rankings });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to compute rankings', detail: String(error) },
      { status: 500 }
    );
  }
}
