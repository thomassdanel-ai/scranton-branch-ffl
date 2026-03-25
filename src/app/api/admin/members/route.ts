import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServiceClient } from '@/lib/supabase/server';

function isAuthed(): boolean {
  const cookieStore = cookies();
  return cookieStore.get('admin_auth')?.value === 'true';
}

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
  if (!isAuthed()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();
  const orgId = await getOrgId(supabase);

  const { data, error } = await supabase
    .from('members')
    .select('*')
    .eq('org_id', orgId)
    .order('full_name');

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch members' }, { status: 500 });
  }

  return NextResponse.json({ members: data });
}

export async function POST(req: NextRequest) {
  if (!isAuthed()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
}
