import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { callerIp, isRateLimited } from '@/lib/rate-limit';

// GET: Return cohort info for a registration page (public, no auth)
export async function GET(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  // Rate-limit per IP (SECURITY_REVIEW #8). Tokens are 128-bit so brute force
  // is infeasible, but we throttle anyway to cheaply mitigate guessing / enum.
  const ip = callerIp(req);
  if (isRateLimited('register-token-get', ip, 30, 60_000)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

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
  // Stricter limit than GET — registration writes and we don't want a single IP
  // able to flood season_registrations / members with junk submissions.
  const ip = callerIp(req);
  if (isRateLimited('register-token-post', ip, 10, 60_000)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const { fullName, email, sleeperUsername } = await req.json();

  if (!fullName || typeof fullName !== 'string' || fullName.trim().length === 0) {
    return NextResponse.json({ error: 'Full name is required' }, { status: 400 });
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Valid email is required' }, { status: 400 });
  }

  // Sanitize optional Sleeper username: trim, strip leading @, lowercase
  let cleanSleeperUsername: string | null = null;
  if (sleeperUsername && typeof sleeperUsername === 'string') {
    const cleaned = sleeperUsername.trim().replace(/^@/, '').toLowerCase();
    if (cleaned && /^[a-z0-9_]+$/.test(cleaned)) {
      cleanSleeperUsername = cleaned;
    } else if (cleaned) {
      return NextResponse.json({ error: 'Sleeper username can only contain letters, numbers, and underscores' }, { status: 400 });
    }
  }

  const supabase = createServiceClient();

  // Validate invite token
  const { data: cohort } = await supabase
    .from('cohorts')
    .select('id, org_id, season_id, status, settings')
    .eq('invite_token', params.token)
    .single();

  if (!cohort) {
    return NextResponse.json({ error: 'Invalid invite link' }, { status: 404 });
  }

  if (cohort.status !== 'open') {
    return NextResponse.json({ error: 'Registration is closed' }, { status: 410 });
  }

  // Upsert member (atomically create or get existing)
  const normalizedEmail = email.toLowerCase().trim();
  const { data: member, error: memberErr } = await supabase
    .from('members')
    .upsert(
      {
        org_id: cohort.org_id,
        full_name: fullName.trim(),
        email: normalizedEmail,
        status: 'active',
        ...(cleanSleeperUsername && { sleeper_username: cleanSleeperUsername }),
      },
      { onConflict: 'org_id,email', ignoreDuplicates: false }
    )
    .select('id')
    .single();

  if (memberErr || !member) {
    return NextResponse.json({ error: 'Failed to create member record' }, { status: 500 });
  }
  const memberId = member.id;

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

  // Check capacity and determine registration status
  let registrationStatus = 'registered';
  let waitlistPosition: number | null = null;

  const settings = cohort.settings as { maxCapacity?: number } | null;
  const maxCapacity = settings?.maxCapacity;

  if (maxCapacity !== undefined && maxCapacity > 0) {
    // Get current registration count (registered or confirmed only)
    const { count } = await supabase
      .from('season_registrations')
      .select('id', { count: 'exact', head: true })
      .eq('cohort_id', cohort.id)
      .in('status', ['registered', 'confirmed']);

    const currentCount = count ?? 0;

    if (currentCount >= maxCapacity) {
      registrationStatus = 'waitlisted';
      // Get the next waitlist position
      const { data: waitlistData } = await supabase
        .from('season_registrations')
        .select('waitlist_position')
        .eq('cohort_id', cohort.id)
        .eq('status', 'waitlisted')
        .order('waitlist_position', { ascending: false })
        .limit(1)
        .single();

      waitlistPosition = (waitlistData?.waitlist_position ?? 0) + 1;
    }
  }

  // Upsert registration (handle race condition on duplicate)
  const { error: regErr } = await supabase
    .from('season_registrations')
    .upsert(
      {
        cohort_id: cohort.id,
        member_id: memberId,
        season_id: cohort.season_id,
        status: registrationStatus,
        waitlist_position: waitlistPosition,
      },
      { onConflict: 'cohort_id,member_id', ignoreDuplicates: false }
    );

  if (regErr) {
    return NextResponse.json({ error: 'Registration failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, alreadyRegistered: false, status: registrationStatus }, { status: 201 });
}
