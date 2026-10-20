import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { serverEnv } from '@/config/env.server';
import { contentSecurityPolicy } from '@/server/security/csp';

export async function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const csp = contentSecurityPolicy(
    nonce,
    process.env.NODE_ENV === 'development',
    serverEnv.NEXT_PUBLIC_SUPABASE_URL,
  );
  // Overwrite incoming nonce/CSP values: visitors cannot choose script authorization.
  request.headers.set('x-nonce', nonce);
  request.headers.set('Content-Security-Policy', csp);
  const privatePath = /^\/(account|auth|admin|cart|checkout|payments)(\/|$)/.test(
    request.nextUrl.pathname,
  );
  let response = NextResponse.next({ request });
  if (serverEnv.AUTH_ENABLED && privatePath) {
    const auth = createServerClient(
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
          getAll: () => request.cookies.getAll(),
          setAll(values) {
            values.forEach(({ name, value }) => request.cookies.set(name, value));
            response = NextResponse.next({ request });
            values.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options),
            );
          },
        },
      },
    );
    try {
      await auth.auth.getClaims();
    } catch {
      /* Protected entry points independently fail closed. */
    }
  }
  response.headers.set('Cache-Control', 'private, no-store, max-age=0');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');
  response.headers.set(
    'Referrer-Policy',
    privatePath ? 'no-referrer' : 'strict-origin-when-cross-origin',
  );
  response.headers.set('Content-Security-Policy', csp);
  if (serverEnv.APP_ENV === 'production')
    response.headers.set('Strict-Transport-Security', 'max-age=31536000');
  return response;
}
export const config = {
  matcher: ['/((?!api/|_next/|images/|fonts/|favicon.ico|robots.txt|sitemap.xml).*)'],
};
