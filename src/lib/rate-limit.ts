import type { NextRequest } from 'next/server';

/**
 * Lightweight in-memory per-IP rate limiter.
 *
 * NOTE: This is per-serverless-instance. In production on Vercel, limits are
 * approximate because each lambda has its own map. For anything truly
 * sensitive (global enumeration, credential stuffing), this should be upgraded
 * to an Upstash Redis sliding window. Good enough for:
 *   - login attempts (already in use)
 *   - identity lookup (#7)
 *   - invite-token lookup (#8)
 *   - first-time admin setup (#2)
 *
 * All buckets are namespaced so a burst on one endpoint does not consume another.
 */

type Entry = { count: number; resetAt: number };
const buckets = new Map<string, Map<string, Entry>>();

/**
 * Derive the caller IP from headers. Falls back to 'unknown' so a misconfigured
 * deploy can't accidentally open the floodgates — 'unknown' is still rate-limited
 * as a single bucket.
 */
export function callerIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  );
}

/**
 * @param bucket  Namespace (e.g. 'identify', 'register-token', 'admin-setup').
 * @param ip      Caller IP.
 * @param max     Max hits allowed in the window.
 * @param windowMs  Window size.
 * @returns true if the caller is over the limit.
 */
export function isRateLimited(bucket: string, ip: string, max: number, windowMs: number): boolean {
  let store = buckets.get(bucket);
  if (!store) {
    store = new Map();
    buckets.set(bucket, store);
  }

  const now = Date.now();
  const entry = store.get(ip);

  if (!entry || now > entry.resetAt) {
    store.set(ip, { count: 1, resetAt: now + windowMs });
    return false;
  }

  entry.count += 1;
  return entry.count > max;
}
