import Link from 'next/link';
import { requireIdentity, isAdministrator } from '@/server/auth/identity';
import { createAuthClient } from '@/server/auth/client';
import { passwordAction, verifyMfaAction } from '@/server/auth/actions';
import { ActionForm } from '@/components/account/action-form';
import { MfaEnrollment } from '@/components/account/mfa-enrollment';
export default async function SecurityPage() {
  await requireIdentity('/account/security');
  const auth = await createAuthClient();
  const { data, error } = await auth.auth.mfa.listFactors();
  if (error) throw new Error('Account security could not be loaded. Please retry.');
  const factor = data.totp.find((item) => item.status === 'verified');
  const { data: claims } = await auth.auth.getClaims();
  return (
    <>
      <h1 className="text-3xl font-bold">Account security</h1>
      <section className="mt-8 max-w-xl rounded-2xl border bg-card p-6">
        <h2 className="mb-5 text-xl font-semibold">Change password</h2>
        <ActionForm
          action={passwordAction}
          label="Change password"
          fields={[
            {
              name: 'currentPassword',
              label: 'Current password',
              type: 'password',
              required: true,
              autoComplete: 'current-password',
              maxLength: 128,
            },
            {
              name: 'password',
              label: 'New password',
              type: 'password',
              required: true,
              minLength: 12,
              maxLength: 128,
              autoComplete: 'new-password',
            },
            {
              name: 'confirmPassword',
              label: 'Confirm password',
              type: 'password',
              required: true,
              minLength: 12,
              maxLength: 128,
              autoComplete: 'new-password',
            },
          ]}
        />
        <Link className="mt-5 inline-block text-sm underline" href="/auth/forgot-password">
          Forgot your password or use Google? Request a reset link
        </Link>
      </section>
      <section className="mt-7 max-w-xl rounded-2xl border bg-card p-6">
        <h2 className="text-xl font-semibold">Authenticator protection</h2>
        <p className="my-5 text-sm leading-6 text-muted-foreground">
          Use an authenticator app for a second verification step. Administrator access requires it.
          Keep your setup key somewhere private; recovery requires the store’s controlled support
          process.
        </p>
        {factor ? (
          <>
            <p role="status" className="mb-5">
              Authenticator enrolled.{' '}
              {claims?.claims.aal === 'aal2'
                ? 'This session has two-step verification.'
                : 'Verify this session with your current code.'}
            </p>
            <ActionForm
              action={verifyMfaAction}
              hidden={{ factorId: factor.id }}
              label="Verify this session"
              fields={[
                {
                  name: 'code',
                  label: 'Six-digit authenticator code',
                  required: true,
                  minLength: 6,
                  maxLength: 6,
                  pattern: '[0-9]{6}',
                  autoComplete: 'one-time-code',
                },
              ]}
            />
          </>
        ) : (
          <MfaEnrollment />
        )}
      </section>
      {(await isAdministrator()) ? (
        <Link className="mt-6 inline-block underline" href="/admin">
          Administrator access
        </Link>
      ) : null}
    </>
  );
}
