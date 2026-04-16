import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { verifyPassword, createSession, destroySession, hashPassword } from '@/lib/auth';
import { callerIp, isRateLimited } from '@/lib/rate-limit';

// POST: Login with email + password
export async function POST(req: NextRequest) {
  const ip = callerIp(req);
  if (isRateLimited('admin-login', ip, 5, 60_000)) {
    return NextResponse.json({ error: 'Too many attempts' }, { status: 429 });
  }

  const { email, password } = await req.json();

  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: user } = await supabase
    .from('admin_users')
    .select('id, password_hash, is_active')
    .eq('email', email.toLowerCase().trim())
    .single();

  if (!user || !user.is_active) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  // Update last login
  await supabase
    .from('admin_users')
    .update({ last_login_at: new Date().toISOString() })
    .eq('id', user.id);

  await createSession(user.id);

  return NextResponse.json({ ok: true });
}

// DELETE: Logout
export async function DELETE() {
  await destroySession();
  return NextResponse.json({ ok: true });
}

// PUT: First-time setup — create the initial super_admin account.
// Only works when no admin has claimed setup yet.
// Protected against TOCTOU by an atomic claim on organizations.setup_claimed_at
// (migration 016). The UPDATE only succeeds for the first caller.
export async function PUT(req: NextRequest) {
  const ip = callerIp(req);
  if (isRateLimited('admin-setup', ip, 5, 60_000)) {
    return NextResponse.json({ error: 'Too many attempts' }, { status: 429 });
  }

  const supabase = createServiceClient();

  const { email, password, displayName } = await req.json();

  if (!email || !password || !displayName) {
    return NextResponse.json({ error: 'Email, password, and display name required' }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
  }

  // Get org
  const { data: org } = await supabase
    .from('organizations')
    .select('id, setup_claimed_at')
    .eq('slug', 'scranton-branch-ffl')
    .single();

  if (!org) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 500 });
  }

  // Short-circuit if already claimed (fast path, no write).
  if (org.setup_claimed_at) {
    return NextResponse.json({ error: 'Admin account already exists' }, { status: 409 });
  }

  // Atomic claim: only one caller wins the race. This is the entire TOCTOU fix.
  const claimTime = new Date().toISOString();
  const { data: claimed, error: claimErr } = await supabase
    .from('organizations')
    .update({ setup_claimed_at: claimTime })
    .eq('id', org.id)
    .is('setup_claimed_at', null)
    .select('id')
    .single();

  if (claimErr || !claimed) {
    // Another concurrent request beat us to the claim.
    return NextResponse.json({ error: 'Admin account already exists' }, { status: 409 });
  }

  // At this point we own the setup slot. Create the super_admin.
  const passwordHash = await hashPassword(password);

  const { data: user, error } = await supabase
    .from('admin_users')
    .insert({
      org_id: org.id,
      email: email.toLowerCase().trim(),
      display_name: displayName.trim(),
      password_hash: passwordHash,
      role: 'super_admin',
    })
    .select('id')
    .single();

  if (error || !user) {
    // Roll back the claim so legitimate admins can retry.
    await supabase
      .from('organizations')
      .update({ setup_claimed_at: null })
      .eq('id', org.id)
      .eq('setup_claimed_at', claimTime);
    return NextResponse.json({ error: 'Failed to create account' }, { status: 500 });
  }

  await createSession(user.id);

  return NextResponse.json({ ok: true }, { status: 201 });
}
