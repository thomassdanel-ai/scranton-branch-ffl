import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAuth, AuthError, type AuthUser } from '@/lib/auth';
import { userCanAccessMember } from '@/lib/auth-scope';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Ensure the caller is authorized AND scoped to the member.
 * Throws AuthError(403) on scope mismatch so callers can surface a clean response.
 */
async function authorizeMemberAccess(memberId: string): Promise<AuthUser> {
  const user = await requireAuth();
  if (user.role !== 'super_admin') {
    const ok = await userCanAccessMember(user, memberId);
    if (!ok) throw new AuthError('Forbidden: no access to this member', 403);
  }
  return user;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!UUID_REGEX.test(id)) {
      return NextResponse.json({ error: 'Invalid member ID' }, { status: 400 });
    }

    await authorizeMemberAccess(id);

    const supabase = createServiceClient();

    const { data: member, error } = await supabase
      .from('members')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    // Fetch season history
    const { data: seasons } = await supabase
      .from('member_seasons')
      .select('*, leagues(name, sleeper_league_id), seasons(year, season_number)')
      .eq('member_id', id)
      .order('created_at', { ascending: false });

    return NextResponse.json({ member, seasons: seasons || [] });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!UUID_REGEX.test(id)) {
      return NextResponse.json({ error: 'Invalid member ID' }, { status: 400 });
    }

    await authorizeMemberAccess(id);

    const body = await req.json();
    const { full_name, display_name, email, status, notes } = body;

    if (full_name !== undefined && (typeof full_name !== 'string' || full_name.trim().length === 0)) {
      return NextResponse.json({ error: 'Full name cannot be empty' }, { status: 400 });
    }

    if (status !== undefined && !['active', 'inactive', 'alumni'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    if (email && typeof email === 'string' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (full_name !== undefined) updates.full_name = full_name.trim();
    if (display_name !== undefined) updates.display_name = display_name?.trim() || null;
    if (email !== undefined) updates.email = email?.trim() || null;
    if (status !== undefined) updates.status = status;
    if (notes !== undefined) updates.notes = notes?.trim() || null;

    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from('members')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'A member with this email already exists' }, { status: 409 });
      }
      return NextResponse.json({ error: 'Failed to update member' }, { status: 500 });
    }

    return NextResponse.json({ member: data });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!UUID_REGEX.test(id)) {
      return NextResponse.json({ error: 'Invalid member ID' }, { status: 400 });
    }

    await authorizeMemberAccess(id);

    const supabase = createServiceClient();

    // Check for existing member_seasons — can't delete if they have history
    const { count } = await supabase
      .from('member_seasons')
      .select('id', { count: 'exact', head: true })
      .eq('member_id', id);

    if (count && count > 0) {
      return NextResponse.json(
        { error: 'Cannot delete a member with season history. Set status to alumni instead.' },
        { status: 409 }
      );
    }

    const { error } = await supabase
      .from('members')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: 'Failed to delete member' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
