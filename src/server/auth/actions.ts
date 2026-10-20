'use server';
import { headers, cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { serverEnv } from '@/config/env.server';
import {
  emailSchema,
  passwordSchema,
  safeReturnTo,
  type FormResult,
} from '@/features/account/validation';
import { createAuthClient } from './client';
import { requireIdentity } from './identity';
import { getAccountDatabase } from '@/server/db/account-client';
import { consumeAuthLimit } from './rate-limit';
import { validRecoveryProof } from './recovery-proof';

async function prepare(subject: string, limit = 8) {
  if (!serverEnv.AUTH_ENABLED) throw new Error('Unavailable');
  // Next also enforces Origin/Host for actions. Pin to configured origin, not forwarded headers.
  if ((await headers()).get('origin') !== new URL(serverEnv.NEXT_PUBLIC_SITE_URL).origin)
    throw new Error('Origin');
  if (
    !(await consumeAuthLimit(
      await getAccountDatabase(),
      serverEnv.AUTH_RATE_LIMIT_SECRET!,
      subject,
      limit,
    ))
  )
    throw new Error('Limit');
  return createAuthClient();
}
const failure: FormResult = {
  status: 'error',
  message:
    'Unable to complete this request. Check your details or wait a few minutes and try again.',
};
export async function signInAction(_: FormResult, form: FormData): Promise<FormResult> {
  const email = emailSchema.safeParse(form.get('email'));
  const password = form.get('password');
  if (
    !email.success ||
    typeof password !== 'string' ||
    password.length < 1 ||
    password.length > 128
  )
    return failure;
  try {
    const client = await prepare(`sign-in:${email.data}`);
    const { data, error } = await client.auth.signInWithPassword({ email: email.data, password });
    if (error || !data.user.email_confirmed_at) return failure;
  } catch {
    return failure;
  }
  redirect(safeReturnTo(form.get('next')));
}
export async function registerAction(_: FormResult, form: FormData): Promise<FormResult> {
  const email = emailSchema.safeParse(form.get('email'));
  const password = passwordSchema.safeParse(form.get('password'));
  if (!email.success || !password.success || form.get('confirmPassword') !== password.data)
    return {
      status: 'error',
      message: 'Enter a valid email and matching passwords of 12–128 characters.',
    };
  try {
    const client = await prepare(`register:${email.data}`, 4);
    const { data, error } = await client.auth.signUp({
      email: email.data,
      password: password.data,
      options: { emailRedirectTo: `${serverEnv.NEXT_PUBLIC_SITE_URL}/auth/callback?next=/account` },
    });
    if (error && (error.status === 429 || (error.status ?? 0) >= 500)) return failure;
    // A project configured for auto-confirm must not leave a silent signup session here.
    if (data.session) await client.auth.signOut({ scope: 'local' });
  } catch {
    return failure;
  }
  return {
    status: 'success',
    message:
      'If registration is available for this address, check your email to confirm it. Then return here to sign in.',
  };
}
export async function recoveryAction(_: FormResult, form: FormData): Promise<FormResult> {
  const email = emailSchema.safeParse(form.get('email'));
  if (!email.success) return { status: 'error', message: 'Enter a valid email address.' };
  try {
    const client = await prepare(`recover:${email.data}`, 4);
    const { error } = await client.auth.resetPasswordForEmail(email.data, {
      redirectTo: `${serverEnv.NEXT_PUBLIC_SITE_URL}/auth/callback?next=/auth/reset-password`,
    });
    if (error && (error.status === 429 || (error.status ?? 0) >= 500)) return failure;
  } catch {
    return failure;
  }
  return {
    status: 'success',
    message:
      'If this address has an account, a password reset link will arrive by email. Open it in this browser.',
  };
}
export async function resendAction(_: FormResult, form: FormData): Promise<FormResult> {
  const email = emailSchema.safeParse(form.get('email'));
  if (!email.success) return { status: 'error', message: 'Enter a valid email address.' };
  try {
    const client = await prepare(`verify:${email.data}`, 4);
    const { error } = await client.auth.resend({
      type: 'signup',
      email: email.data,
      options: { emailRedirectTo: `${serverEnv.NEXT_PUBLIC_SITE_URL}/auth/callback?next=/account` },
    });
    if (error && (error.status === 429 || (error.status ?? 0) >= 500)) return failure;
  } catch {
    return failure;
  }
  return {
    status: 'success',
    message:
      'If confirmation is needed, a new link will arrive by email. Open it in the browser where you registered.',
  };
}
export async function passwordAction(_: FormResult, form: FormData): Promise<FormResult> {
  const identity = await requireIdentity('/account/security');
  const password = passwordSchema.safeParse(form.get('password'));
  if (!password.success || form.get('confirmPassword') !== password.data)
    return { status: 'error', message: 'Enter matching passwords of 12–128 characters.' };
  try {
    const client = await prepare(`password:${identity.id}`, 5);
    const current = form.get('currentPassword');
    if (typeof current !== 'string' || !current) {
      const { data, error } = await client.auth.getClaims();
      if (
        error ||
        typeof data?.claims.session_id !== 'string' ||
        !validRecoveryProof(
          (await cookies()).get('sd-recovery')?.value,
          serverEnv.AUTH_RATE_LIMIT_SECRET!,
          identity.id,
          data.claims.session_id,
        )
      )
        return {
          status: 'error',
          message:
            'Open a fresh password reset link, or change your password from account security using your current password.',
        };
    } else if (current.length > 128) return failure;
    const { error } = await client.auth.updateUser({
      password: password.data,
      ...(typeof current === 'string' && current ? { current_password: current } : {}),
    });
    if (error) return failure;
    (await cookies()).delete('sd-recovery');
    const signOut = await client.auth.signOut({ scope: 'global' });
    if (signOut.error)
      return {
        status: 'success',
        message: 'Password changed. Sign out everywhere from account security to finish.',
      };
  } catch {
    return failure;
  }
  redirect('/auth/sign-in?changed=1');
}
export async function signOutAction() {
  if ((await headers()).get('origin') !== new URL(serverEnv.NEXT_PUBLIC_SITE_URL).origin) return;
  const client = await createAuthClient();
  const { error } = await client.auth.signOut({ scope: 'global' });
  if (error) throw new Error('Sign out could not be completed. Please try again.');
  redirect('/auth/sign-in?signedOut=1');
}
export async function googleAction() {
  if (!serverEnv.GOOGLE_AUTH_ENABLED) redirect('/auth/error');
  let destination: string | undefined;
  try {
    const client = await prepare('google-start', 200);
    const { data, error } = await client.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${serverEnv.NEXT_PUBLIC_SITE_URL}/auth/callback?next=/account`,
        skipBrowserRedirect: true,
      },
    });
    if (
      !error &&
      data.url &&
      new URL(data.url).origin === new URL(serverEnv.NEXT_PUBLIC_SUPABASE_URL!).origin
    )
      destination = data.url;
  } catch {
    /* generic auth error */
  }
  redirect(destination || '/auth/error');
}

export type MfaResult = FormResult & { factorId?: string; secret?: string };
export async function enrollMfaAction(): Promise<MfaResult> {
  const identity = await requireIdentity('/account/security');
  try {
    const client = await prepare(`mfa-enroll:${identity.id}`, 5);
    const { data: factors, error: listError } = await client.auth.mfa.listFactors();
    if (listError || factors.totp.some((factor) => factor.status === 'verified'))
      return {
        status: 'error',
        message: 'An authenticator is already enrolled. Use its current code below.',
      };
    for (const factor of factors.all.filter(
      (item) => item.factor_type === 'totp' && item.status === 'unverified',
    ))
      await client.auth.mfa.unenroll({ factorId: factor.id });
    const { data, error } = await client.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: 'S & D authenticator',
    });
    if (error) return failure;
    return {
      status: 'success',
      message: 'Add this setup key to your authenticator app, then enter its six-digit code below.',
      secret: data.totp.secret,
      factorId: data.id,
    };
  } catch {
    return failure;
  }
}
export async function verifyMfaAction(_: FormResult, form: FormData): Promise<FormResult> {
  const identity = await requireIdentity('/account/security', true);
  const factorId = String(form.get('factorId'));
  const code = String(form.get('code'));
  if (!/^[0-9]{6}$/.test(code) || !/^[0-9a-f-]{36}$/i.test(factorId)) return failure;
  try {
    const client = await prepare(`mfa-verify:${identity.id}`, 10);
    const { error } = await client.auth.mfa.challengeAndVerify({ factorId, code });
    if (error)
      return {
        status: 'error',
        message: 'That code could not be verified. Try a fresh code from your authenticator.',
      };
  } catch {
    return failure;
  }
  redirect('/account/security?verified=1');
}
