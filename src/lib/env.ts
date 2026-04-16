/**
 * Runtime environment-variable validation.
 *
 * Called at module-load time from server entry points (API routes that need
 * the values, cron handlers, auth middleware). This surfaces a clear error at
 * boot rather than `undefined is not an object` crashes deep in request paths.
 *
 * NOTE: we intentionally do NOT validate in client bundles. Next inlines
 * `NEXT_PUBLIC_*` at build time; anything else on the client would leak.
 */

type EnvKey =
  | 'NEXT_PUBLIC_SUPABASE_URL'
  | 'NEXT_PUBLIC_SUPABASE_ANON_KEY'
  | 'SUPABASE_SERVICE_ROLE_KEY'
  | 'CRON_SECRET'
  | 'RECAP_API_KEY'
  | 'ANTHROPIC_API_KEY'
  | 'RESEND_API_KEY'
  | 'UPSTASH_REDIS_REST_URL'
  | 'UPSTASH_REDIS_REST_TOKEN';

// Required in every server environment.
const ALWAYS_REQUIRED: EnvKey[] = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
];

// Required only if the matching feature is wired up. Callers opt in via
// `requireEnv('CRON_SECRET')` from the route that actually uses it.
export function requireEnv(key: EnvKey): string {
  const v = process.env[key];
  if (!v || v.trim().length === 0) {
    throw new Error(
      `Missing required environment variable: ${key}. ` +
        `Check your Vercel project env vars or local .env.local file.`,
    );
  }
  return v;
}

/**
 * Call once per process to verify the baseline Supabase config is present.
 * Re-import is safe — this is a pure read of process.env.
 */
export function assertBaselineEnv(): void {
  const missing: string[] = [];
  for (const key of ALWAYS_REQUIRED) {
    const v = process.env[key];
    if (!v || v.trim().length === 0) missing.push(key);
  }
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}. ` +
        `The app cannot start without these. Check your Vercel project env ` +
        `vars or local .env.local file.`,
    );
  }
}

// Only run at module init on the server. Next.js will tree-shake this out of
// client bundles because this file is only imported from server-only paths.
if (typeof window === 'undefined') {
  // Build step (`next build`) doesn't always have runtime env, so only throw
  // when actually serving. Vercel sets NEXT_RUNTIME to 'nodejs' or 'edge' in
  // lambdas; during build it's unset.
  if (process.env.NEXT_RUNTIME) {
    assertBaselineEnv();
  }
}
