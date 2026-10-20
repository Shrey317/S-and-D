import { requireIdentity } from '@/server/auth/identity';
import { createAuthClient } from '@/server/auth/client';
import { verifyMfaAction, signOutAction } from '@/server/auth/actions';
import { ActionForm } from '@/components/account/action-form';
import { Button } from '@/components/ui/button';
export const dynamic = 'force-dynamic';
export default async function MfaPage() {
  await requireIdentity('/account', true);
  const { data, error } = await (await createAuthClient()).auth.mfa.listFactors();
  if (error) throw new Error('Verification is temporarily unavailable.');
  const factor = data.totp.find((item) => item.status === 'verified');
  return (
    <main id="main-content" className="site-container py-16">
      <div className="mx-auto max-w-lg rounded-3xl border bg-card p-8">
        <h1 className="text-3xl font-bold">One more step</h1>
        <p className="my-6 leading-7 text-muted-foreground">
          Enter the current code from your authenticator before opening your account.
        </p>
        {factor ? (
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
        ) : (
          <p>No supported authenticator was found. Contact the store for help.</p>
        )}
        <form action={signOutAction} className="mt-6">
          <Button type="submit" variant="outline">
            Sign out
          </Button>
        </form>
      </div>
    </main>
  );
}
