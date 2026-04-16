import { createServerClient } from '@supabase/ssr';
import { requireEnv } from '@/lib/env';

export function createServiceClient() {
  return createServerClient(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
    {
      cookies: {
        getAll: () => [],
        setAll: () => {},
      },
    }
  );
}
