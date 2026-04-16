import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAuth, AuthError } from '@/lib/auth';
import { requireCohortAccess } from '@/lib/auth-scope';

// GET: List registrations for a cohort
export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const user = await requireAuth();
    await requireCohortAccess(user, params.id);

    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from('season_registrations')
      .select('*, members(full_name, display_name, email)')
      .eq('cohort_id', params.id)
      .order('registered_at', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ registrations: data ?? [] });
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
