import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { verifyPassword, createSession, destroySession, hashPassword } from '@/lib/auth';

const attempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 60_000;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || now > entry.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > MAX_ATTEMPTS;
}

// POST: Login with email + password
export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (isRateLimited(ip)) {
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

// PUT: First-time setup — create the initial super_admin account
// Only works when no admin_users exist yet
export async function PUT(req: NextRequest) {
  const { email, password, displayName } = await req.json();

  if (!email || !password || !displayName) {
    return NextResponse.json({ error: 'Email, password, and display name required' }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Check if any admin users exist
  const { count } = await supabase
    .from('admin_users')
    .select('id', { count: 'exact', head: true });

  if (count && count > 0) {
    return NextResponse.json({ error: 'Admin account already exists' }, { status: 409 });
  }

  // Get org
  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('slug', 'scranton-branch-ffl')
    .single();

  if (!org) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 500 });
  }

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
    return NextResponse.json({ error: 'Failed to create account' }, { status: 500 });
  }

  await createSession(user.id);

  return NextResponse.json({ ok: true }, { status: 201 });
}
