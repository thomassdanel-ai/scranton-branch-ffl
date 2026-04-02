import { NextRequest } from 'next/server';

/**
 * Validate Bearer token for recap API endpoints.
 * Returns true if authorized.
 */
export function isRecapAuthorized(req: NextRequest): boolean {
  const key = process.env.RECAP_API_KEY;
  if (!key) return false;

  const authHeader = req.headers.get('authorization');
  if (!authHeader) return false;

  return authHeader === `Bearer ${key}`;
}
