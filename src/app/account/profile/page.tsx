import { requireIdentity } from '@/server/auth/identity';
import { getAccountDatabase } from '@/server/db/account-client';
import { readAccount } from '@/server/account/repository';
import { profileAction } from '@/server/account/actions';
import { ActionForm } from '@/components/account/action-form';
export default async function ProfilePage() {
  const user = await requireIdentity('/account/profile');
  const { profile } = await readAccount(await getAccountDatabase(), user.id);
  return (
    <>
      <h1 className="text-3xl font-bold">Your profile</h1>
      <p className="mt-4 break-all text-muted-foreground">Verified email: {user.email}</p>
      <div className="mt-8 max-w-xl rounded-2xl border bg-card p-6">
        <ActionForm
          action={profileAction}
          label="Save profile"
          fields={[
            {
              name: 'name',
              label: 'Full name',
              required: true,
              value: profile.name,
              autoComplete: 'name',
              minLength: 2,
              maxLength: 100,
            },
            {
              name: 'phone',
              label: 'South African phone number (optional)',
              type: 'tel',
              value: profile.phone,
              autoComplete: 'tel',
              maxLength: 20,
            },
          ]}
        />
      </div>
      <p className="mt-5 text-sm text-muted-foreground">
        Email changes are not supported here yet. Your sign-in email remains unchanged.
      </p>
    </>
  );
}
