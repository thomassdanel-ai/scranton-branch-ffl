import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAuth, AuthError } from '@/lib/auth';
import { requireCohortAccess } from '@/lib/auth-scope';
import { getActiveSeasonId } from '@/lib/config';
import { sanitizeRecapHtml } from '@/lib/sanitize-html';

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

const PostSchema = z.object({
  seasonId: z.string().uuid(),
  week: z.number().int().min(1).max(25),
  subject: z.string().min(1).max(300),
  htmlContent: z.string().min(1).max(500_000),
  cohortId: z.string().uuid().nullable().optional(),
  publish: z.boolean().optional(),
});

// POST: Create or update a recap/newsletter
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    const supabase = createServiceClient();

    const parsed = PostSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', issues: parsed.error.issues }, { status: 400 });
    }
    const { seasonId, week, subject, htmlContent, cohortId, publish } = parsed.data;

    // Cohort scoping — commissioners can only write recaps for their own cohorts.
    // Org-wide recaps (cohortId null) remain super-admin only.
    if (cohortId) {
      try {
        await requireCohortAccess(user, cohortId);
      } catch {
        return NextResponse.json({ error: 'Forbidden: no access to this cohort' }, { status: 403 });
      }
    } else if (user.role !== 'super_admin') {
      return NextResponse.json(
        { error: 'Only super admins can publish org-wide recaps' },
        { status: 403 },
      );
    }

    // Sanitize HTML before storage (defense in depth — render path also sanitizes)
    const cleanHtml = sanitizeRecapHtml(htmlContent);

    const { data, error } = await supabase
      .from('newsletters')
      .upsert(
        {
          season_id: seasonId,
          week,
          subject,
          html_content: cleanHtml,
          cohort_id: cohortId ?? null,
          sent_at: publish ? new Date().toISOString() : null,
        },
        { onConflict: 'season_id,week' },
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
