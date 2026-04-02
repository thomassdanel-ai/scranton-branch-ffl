import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAuth, AuthError } from '@/lib/auth';
import { getScopedCohortIds } from '@/lib/auth-scope';
import { getActiveSeasonId } from '@/lib/config';
import crypto from 'crypto';

// GET: List cohorts for current season (scoped to admin's access)
export async function GET() {
  try {
    const user = await requireAuth();
    const supabase = createServiceClient();

    const seasonId = await getActiveSeasonId();
    if (!seasonId) {
      return NextResponse.json({ cohorts: [] });
    }

    const scopedIds = await getScopedCohortIds(user, seasonId);

    let query = supabase
      .from('cohorts')
      .select('*, season_registrations(count)')
      .eq('season_id', seasonId)
      .order('created_at', { ascending: true });

    if (scopedIds !== null) {
      query = query.in('id', scopedIds);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ cohorts: data ?? [] });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}

// POST: Create a new cohort
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    const supabase = createServiceClient();

    const { name, color } = await req.json();

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Cohort name is required' }, { status: 400 });
    }

    const seasonId = await getActiveSeasonId();
    if (!seasonId) {
      return NextResponse.json({ error: 'No active season' }, { status: 400 });
    }

    const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const inviteToken = crypto.randomBytes(16).toString('hex');

    const { data, error } = await supabase
      .from('cohorts')
      .insert({
        org_id: user.orgId,
        season_id: seasonId,
        name: name.trim(),
        slug,
        invite_token: inviteToken,
        color: color || '#1a73e8',
        status: 'open',
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Assign cohort to creating user (unless they're a super_admin)
    if (user.role !== 'super_admin') {
      const { error: assignmentError } = await supabase
        .from('admin_cohort_assignments')
        .insert({
          admin_user_id: user.id,
          cohort_id: data.id,
        });

      if (assignmentError) {
        return NextResponse.json({ error: assignmentError.message }, { status: 500 });
      }
    }

    return NextResponse.json({ cohort: data }, { status: 201 });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
