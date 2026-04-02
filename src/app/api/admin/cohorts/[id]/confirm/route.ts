import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAuth, AuthError } from '@/lib/auth';
import { requireCohortAccess } from '@/lib/auth-scope';

// POST: Send confirmation requests — mark 'registered' members as needing confirmation
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    await requireCohortAccess(user, params.id);

    const supabase = createServiceClient();
    const { memberIds, maxSlots } = await req.json() as {
      memberIds?: string[];
      maxSlots?: number;
    };

    // Get all registered members for this cohort
    const { data: registrations } = await supabase
      .from('season_registrations')
      .select('id, member_id, status')
      .eq('cohort_id', params.id)
      .eq('status', 'registered')
      .order('registered_at', { ascending: true });

    if (!registrations || registrations.length === 0) {
      return NextResponse.json({ error: 'No registered members to confirm' }, { status: 400 });
    }

    // Filter to specific members if provided
    const toProcess = memberIds
      ? registrations.filter((r) => memberIds.includes(r.member_id))
      : registrations;

    const limit = maxSlots ?? toProcess.length;
    const toConfirm = toProcess.slice(0, limit);
    const toWaitlist = toProcess.slice(limit);

    // Confirm selected members
    if (toConfirm.length > 0) {
      await supabase
        .from('season_registrations')
        .update({ status: 'confirmed', confirmed_at: new Date().toISOString() })
        .in('id', toConfirm.map((r) => r.id));
    }

    // Waitlist overflow
    for (let i = 0; i < toWaitlist.length; i++) {
      await supabase
        .from('season_registrations')
        .update({ status: 'waitlisted', waitlist_position: i + 1 })
        .eq('id', toWaitlist[i].id);
    }

    return NextResponse.json({
      confirmed: toConfirm.length,
      waitlisted: toWaitlist.length,
    });
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
