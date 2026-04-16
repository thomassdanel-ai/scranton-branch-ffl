import { NextRequest } from 'next/server';
import crypto from 'crypto';

/**
 * Timing-safe Bearer token check for cron endpoints.
 * Uses `crypto.timingSafeEqual` so response time does not leak how many
 * characters of CRON_SECRET an attacker has guessed correctly.
 *
 * Returns true only when CRON_SECRET is configured AND the header matches.
 */
export function isCronAuthorized(req: NextRequest): boolean {
  const key = process.env.CRON_SECRET;
  if (!key) return false;

  const header = req.headers.get('authorization');
  if (!header) return false;

  const expected = `Bearer ${key}`;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);

  // timingSafeEqual requires equal-length buffers.
  if (a.length !== b.length) return false;

  try {
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
