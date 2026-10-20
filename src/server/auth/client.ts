import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { serverEnv } from '@/config/env.server';

export async function createAuthClient() {
  if (!serverEnv.AUTH_ENABLED) throw new Error('Accounts are unavailable.');
  const jar = await cookies();
  return createServerClient(
    serverEnv.NEXT_PUBLIC_SUPABASE_URL!,
    serverEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookieOptions: {
        httpOnly: true,
        sameSite: 'lax',
        secure: new URL(serverEnv.NEXT_PUBLIC_SITE_URL).protocol === 'https:',
        path: '/',
      },
      global: {
        fetch: (input, init) =>
          fetch(input, { ...init, cache: 'no-store', signal: AbortSignal.timeout(10000) }),
      },
      cookies: {
        getAll: () => jar.getAll(),
        setAll: (values) => {
          // Server Components cannot write cookies; proxy refreshes before their reads.
          try {
            values.forEach(({ name, value, options }) => jar.set(name, value, options));
          } catch {
            /* read-only render */
          }
        },
      },
    },
  );
}
