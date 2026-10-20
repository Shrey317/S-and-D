import { NextResponse, type NextRequest } from 'next/server';
import { createAuthClient } from '@/server/auth/client';
import { serverEnv } from '@/config/env.server';
import { safeReturnTo } from '@/features/account/validation';
import { cookies } from 'next/headers';
import { recoveryProof } from '@/server/auth/recovery-proof';
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  let next = '/auth/error';
  if (
    serverEnv.AUTH_ENABLED &&
    code &&
    code.length <= 2048 &&
    !request.nextUrl.searchParams.has('error')
  ) {
    try {
      const auth = await createAuthClient();
      const { error } = await auth.auth.exchangeCodeForSession(code);
      const { data } = error ? { data: { user: null } } : await auth.auth.getUser();
      if (data.user?.email_confirmed_at && !data.user.is_anonymous) {
        const requested = request.nextUrl.searchParams.get('next');
        next = requested === '/auth/reset-password' ? requested : safeReturnTo(requested);
        if (next === '/auth/reset-password') {
          const { data: claims } = await auth.auth.getClaims();
          if (typeof claims?.claims.session_id !== 'string') throw new Error('Invalid session');
          (await cookies()).set(
            'sd-recovery',
            recoveryProof(
              serverEnv.AUTH_RATE_LIMIT_SECRET!,
              data.user.id,
              claims.claims.session_id,
              Date.now() + 600000,
            ),
            {
              httpOnly: true,
              sameSite: 'lax',
              secure: new URL(serverEnv.NEXT_PUBLIC_SITE_URL).protocol === 'https:',
              path: '/',
              maxAge: 600,
            },
          );
        }
      }
    } catch {
      next = '/auth/error'; /* Never expose provider details or codes. */
    }
  }
  return NextResponse.redirect(new URL(next, serverEnv.NEXT_PUBLIC_SITE_URL), {
    status: 303,
    headers: { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' },
  });
}
