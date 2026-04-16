import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAuth, AuthError } from '@/lib/auth';
import { requireCohortAccess } from '@/lib/auth-scope';

// POST: Promote waitlisted members to confirmed
export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const user = await requireAuth();
    await requireCohortAccess(user, params.id);

    const supabase = createServiceClient();
    const { count } = await req.json() as { count?: number };

    const promoteCount = count ?? 1;

    // Get waitlisted members in order
    const { data: waitlisted } = await supabase
      .from('season_registrations')
      .select('id')
      .eq('cohort_id', params.id)
      .eq('status', 'waitlisted')
      .order('waitlist_position', { ascending: true })
      .limit(promoteCount);

    if (!waitlisted || waitlisted.length === 0) {
      return NextResponse.json({ error: 'No waitlisted members' }, { status: 400 });
    }

    await supabase
      .from('season_registrations')
      .update({
        status: 'promoted',
        confirmed_at: new Date().toISOString(),
        waitlist_position: null,
      })
      .in('id', waitlisted.map((w) => w.id));

    return NextResponse.json({ promoted: waitlisted.length });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    if (err instanceof Error && err.message.includes('Forbidden')) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    throw err;
  }
}
