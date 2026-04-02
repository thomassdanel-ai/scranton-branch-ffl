import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAuth, AuthError } from '@/lib/auth';
import { requireCohortAccess } from '@/lib/auth-scope';

// PUT: Update cohort (name, color, status)
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    await requireCohortAccess(user, params.id);

    const supabase = createServiceClient();
    const body = await req.json();

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.name) updates.name = body.name.trim();
    if (body.color) updates.color = body.color;
    if (body.status) updates.status = body.status;
    if (body.settings) updates.settings = body.settings;

    const { data, error } = await supabase
      .from('cohorts')
      .update(updates)
      .eq('id', params.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ cohort: data });
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
