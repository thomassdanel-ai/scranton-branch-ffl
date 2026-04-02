import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAuth, AuthError } from '@/lib/auth';
import { getActiveSeasonId } from '@/lib/config';

// GET: List recaps for current season
export async function GET() {
  try {
    await requireAuth();
    const supabase = createServiceClient();

    const seasonId = await getActiveSeasonId();
    if (!seasonId) {
      // Fall back to most recent season
      const { data: latest } = await supabase
        .from('seasons')
        .select('id')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      if (!latest) return NextResponse.json({ recaps: [] });
    }

    const { data } = await supabase
      .from('newsletters')
      .select('id, season_id, week, subject, sent_at, created_at, cohort_id')
      .eq('season_id', seasonId!)
      .order('week', { ascending: false });

    return NextResponse.json({ recaps: data ?? [] });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}

// POST: Create or update a recap/newsletter
export async function POST(req: NextRequest) {
  try {
    await requireAuth();
    const supabase = createServiceClient();

    const { seasonId, week, subject, htmlContent, cohortId, publish } = await req.json();

    if (!seasonId || !week || !subject || !htmlContent) {
      return NextResponse.json({ error: 'seasonId, week, subject, and htmlContent are required' }, { status: 400 });
    }

    // Upsert newsletter
    const { data, error } = await supabase
      .from('newsletters')
      .upsert(
        {
          season_id: seasonId,
          week,
          subject,
          html_content: htmlContent,
          cohort_id: cohortId ?? null,
          sent_at: publish ? new Date().toISOString() : null,
        },
        { onConflict: 'season_id,week' }
      )
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ recap: data });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
