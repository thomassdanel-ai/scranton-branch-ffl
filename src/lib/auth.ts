import { cookies } from 'next/headers';
import { createServiceClient } from '@/lib/supabase/server';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const SESSION_COOKIE = 'admin_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24; // 24 hours

export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
  role: 'super_admin' | 'commissioner';
  orgId: string;
};

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function createSession(userId: string): Promise<string> {
  const supabase = createServiceClient();
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString();

  await supabase.from('admin_sessions').insert({
    user_id: userId,
    token,
    expires_at: expiresAt,
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: SESSION_TTL_SECONDS,
    path: '/',
  });

  return token;
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (token) {
    const supabase = createServiceClient();
    await supabase.from('admin_sessions').delete().eq('token', token);
  }

  cookieStore.set(SESSION_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 0,
    path: '/',
  });
}

export async function getAuthUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const supabase = createServiceClient();

  const { data: session } = await supabase
    .from('admin_sessions')
    .select('user_id, expires_at')
    .eq('token', token)
    .single();

  if (!session) return null;

  // Check expiry
  if (new Date(session.expires_at) < new Date()) {
    await supabase.from('admin_sessions').delete().eq('token', token);
    return null;
  }

  const { data: user } = await supabase
    .from('admin_users')
    .select('id, email, display_name, role, org_id, is_active')
    .eq('id', session.user_id)
    .single();

  if (!user || !user.is_active) return null;

  return {
    id: user.id,
    email: user.email,
    displayName: user.display_name,
    role: user.role as AuthUser['role'],
    orgId: user.org_id,
  };
}

export async function requireAuth(): Promise<AuthUser> {
  const user = await getAuthUser();
  if (!user) {
    throw new AuthError('Unauthorized', 401);
  }
  return user;
}

export async function requireSuperAdmin(): Promise<AuthUser> {
  const user = await requireAuth();
  if (user.role !== 'super_admin') {
    throw new AuthError('Forbidden', 403);
  }
  return user;
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}
