import { NextRequest } from 'next/server';
import crypto from 'crypto';

/**
 * Validate Bearer token for recap API endpoints.
 * Uses timing-safe comparison to prevent timing attacks.
 * Returns true if authorized.
 */
export function isRecapAuthorized(req: NextRequest): boolean {
  const key = process.env.RECAP_API_KEY;
  if (!key) return false;

  const authHeader = req.headers.get('authorization');
  if (!authHeader) return false;

  const expected = `Bearer ${key}`;

  // Check lengths match first (timingSafeEqual requires equal length buffers)
  if (Buffer.byteLength(authHeader) !== Buffer.byteLength(expected)) {
    return false;
  }

  // Use timing-safe comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected));
  } catch {
    return false;
  }
}
