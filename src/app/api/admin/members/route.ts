import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAuth, AuthError } from '@/lib/auth';
import { getScopedMemberIds } from '@/lib/auth-scope';

async function getOrgId(supabase: ReturnType<typeof createServiceClient>): Promise<string> {
  const { data } = await supabase
    .from('organizations')
    .select('id')
    .eq('slug', 'scranton-branch-ffl')
    .single();
  if (!data) throw new Error('Organization not found');
  return data.id;
}

export async function GET() {
  try {
    const user = await requireAuth();

    const supabase = createServiceClient();
    const orgId = await getOrgId(supabase);

    // Commissioners only see members in their cohort scope.
    // Super admins see everyone in the org.
    const scopedIds = await getScopedMemberIds(user);

    let query = supabase
      .from('members')
      .select('*')
      .eq('org_id', orgId)
      .order('full_name');

    if (scopedIds !== null) {
      if (scopedIds.length === 0) {
        return NextResponse.json({ members: [] });
      }
      query = query.in('id', scopedIds);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch members' }, { status: 500 });
    }

    return NextResponse.json({ members: data });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}

export async function POST(req: NextRequest) {
  try {
    // Super admin only — new members have no existing cohort affiliation,
    // so there's no way to scope a commissioner's write. Fits existing flow
    // where member creation happens during season setup.
    const user = await requireAuth();
    if (user.role !== 'super_admin') {
      return NextResponse.json(
        { error: 'Only super admins can create members' },
        { status: 403 },
      );
    }

    const body = await req.json();
    const { full_name, display_name, email, notes } = body;

    if (!full_name || typeof full_name !== 'string' || full_name.trim().length === 0) {
      return NextResponse.json({ error: 'Full name is required' }, { status: 400 });
    }

    if (email && typeof email === 'string' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    const supabase = createServiceClient();
    const orgId = await getOrgId(supabase);

    const { data, error } = await supabase
      .from('members')
      .insert({
        org_id: orgId,
        full_name: full_name.trim(),
        display_name: display_name?.trim() || null,
        email: email?.trim() || null,
        notes: notes?.trim() || null,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'A member with this email already exists' }, { status: 409 });
      }
      return NextResponse.json({ error: 'Failed to create member' }, { status: 500 });
    }

    return NextResponse.json({ member: data }, { status: 201 });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
