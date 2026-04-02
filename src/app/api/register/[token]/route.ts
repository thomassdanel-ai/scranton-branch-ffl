import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

// GET: Return cohort info for a registration page (public, no auth)
export async function GET(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  const supabase = createServiceClient();

  const { data: cohort } = await supabase
    .from('cohorts')
    .select('id, name, color, status, season_id, seasons(year)')
    .eq('invite_token', params.token)
    .single();

  if (!cohort) {
    return NextResponse.json({ error: 'Invalid invite link' }, { status: 404 });
  }

  if (cohort.status !== 'open') {
    return NextResponse.json({ error: 'Registration is closed for this cohort' }, { status: 410 });
  }

  // Get registration count
  const { count } = await supabase
    .from('season_registrations')
    .select('id', { count: 'exact', head: true })
    .eq('cohort_id', cohort.id);

  const season = cohort.seasons as unknown as { year: string } | null;

  return NextResponse.json({
    cohort: {
      name: cohort.name,
      color: cohort.color,
      status: cohort.status,
      seasonYear: season?.year ?? '',
      registeredCount: count ?? 0,
    },
  });
}

// POST: Register for a cohort (public, no auth)
export async function POST(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  const { fullName, email } = await req.json();

  if (!fullName || typeof fullName !== 'string' || fullName.trim().length === 0) {
    return NextResponse.json({ error: 'Full name is required' }, { status: 400 });
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Valid email is required' }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Validate invite token
  const { data: cohort } = await supabase
    .from('cohorts')
    .select('id, org_id, season_id, status')
    .eq('invite_token', params.token)
    .single();

  if (!cohort) {
    return NextResponse.json({ error: 'Invalid invite link' }, { status: 404 });
  }

  if (cohort.status !== 'open') {
    return NextResponse.json({ error: 'Registration is closed' }, { status: 410 });
  }

  // Find or create member
  const normalizedEmail = email.toLowerCase().trim();
  const { data: existingMember } = await supabase
    .from('members')
    .select('id')
    .eq('org_id', cohort.org_id)
    .eq('email', normalizedEmail)
    .single();

  let memberId: string;

  if (existingMember) {
    memberId = existingMember.id;
  } else {
    const { data: newMember, error: memberErr } = await supabase
      .from('members')
      .insert({
        org_id: cohort.org_id,
        full_name: fullName.trim(),
        email: normalizedEmail,
        status: 'active',
      })
      .select('id')
      .single();

    if (memberErr || !newMember) {
      return NextResponse.json({ error: 'Failed to create member record' }, { status: 500 });
    }
    memberId = newMember.id;
  }

  // Check if already registered for this cohort
  const { data: existing } = await supabase
    .from('season_registrations')
    .select('id, status')
    .eq('cohort_id', cohort.id)
    .eq('member_id', memberId)
    .single();

  if (existing) {
    return NextResponse.json({
      ok: true,
      alreadyRegistered: true,
      status: existing.status,
    });
  }

  // Create registration
  const { error: regErr } = await supabase
    .from('season_registrations')
    .insert({
      cohort_id: cohort.id,
      member_id: memberId,
      season_id: cohort.season_id,
      status: 'registered',
    });

  if (regErr) {
    return NextResponse.json({ error: 'Registration failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, alreadyRegistered: false }, { status: 201 });
}
