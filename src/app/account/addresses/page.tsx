import Link from 'next/link';
import { requireIdentity } from '@/server/auth/identity';
import { getAccountDatabase } from '@/server/db/account-client';
import { readAccount } from '@/server/account/repository';
import { addressAction, removeAddressAction } from '@/server/account/actions';
import { ActionForm, type FormField } from '@/components/account/action-form';
export default async function AddressesPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const user = await requireIdentity('/account/addresses');
  const { addresses } = await readAccount(await getAccountDatabase(), user.id);
  const { edit } = await searchParams;
  const address = addresses.find((item) => item.id === edit);
  const fields: FormField[] = [
    {
      name: 'label',
      label: 'Address label',
      required: true,
      maxLength: 40,
      value: address?.label || '',
    },
    {
      name: 'recipient',
      label: 'Recipient name',
      required: true,
      autoComplete: 'name',
      minLength: 2,
      maxLength: 100,
      value: address?.recipient || '',
    },
    {
      name: 'phone',
      label: 'South African phone number',
      type: 'tel',
      required: true,
      autoComplete: 'tel',
      maxLength: 20,
      value: address?.phone || '',
    },
    {
      name: 'street',
      label: 'Street address',
      required: true,
      autoComplete: 'street-address',
      minLength: 3,
      maxLength: 200,
      value: address?.street || '',
    },
    {
      name: 'suburb',
      label: 'Suburb',
      required: true,
      autoComplete: 'address-level3',
      minLength: 2,
      maxLength: 100,
      value: address?.suburb || '',
    },
    {
      name: 'city',
      label: 'City',
      required: true,
      autoComplete: 'address-level2',
      minLength: 2,
      maxLength: 100,
      value: address?.city || '',
    },
    {
      name: 'postalCode',
      label: 'Postal code',
      required: true,
      autoComplete: 'postal-code',
      pattern: '[0-9]{4}',
      maxLength: 4,
      value: address?.postalCode || '',
    },
    {
      name: 'instructions',
      label: 'Delivery instructions (optional)',
      maxLength: 500,
      value: address?.instructions || '',
    },
    {
      name: 'isDefault',
      label: 'Use as my default address',
      type: 'checkbox',
      checked: address?.isDefault || false,
    },
  ];
  return (
    <>
      <h1 className="text-3xl font-bold">Your addresses</h1>
      <Link href="/checkout" className="mt-4 inline-block underline">
        Return to checkout
      </Link>
      <p className="mt-4 leading-7 text-muted-foreground">
        Save up to 10 South African addresses. Saving an address does not confirm delivery
        eligibility; this is checked at checkout.
      </p>
      <div className="mt-8 grid gap-5 sm:grid-cols-2">
        {addresses.map((item) => (
          <article key={item.id} className="rounded-2xl border bg-card p-6">
            <h2 className="text-xl font-semibold">
              {item.label}
              {item.isDefault ? ' · Default' : ''}
            </h2>
            <p className="mt-3 leading-7">
              {item.recipient}
              <br />
              {item.street}
              <br />
              {item.suburb}, {item.city}, {item.postalCode}
              <br />
              {item.phone}
            </p>
            {item.instructions ? (
              <p className="mt-2 text-sm text-muted-foreground">{item.instructions}</p>
            ) : null}
            <Link
              className="my-4 inline-block underline"
              href={`/account/addresses?edit=${item.id}#address-form`}
            >
              Edit {item.label}
            </Link>
            <ActionForm
              action={removeAddressAction}
              hidden={{ id: item.id }}
              label={`Remove ${item.label}`}
            />
          </article>
        ))}
      </div>
      {!addresses.length ? (
        <p className="mt-6 rounded-xl bg-secondary p-5">You haven’t saved an address yet.</p>
      ) : null}
      <section id="address-form" className="mt-10 max-w-xl rounded-2xl border bg-card p-6">
        <h2 className="mb-6 text-2xl font-semibold">
          {address ? `Edit ${address.label}` : 'Add an address'}
        </h2>
        <ActionForm
          key={address?.id || 'new'}
          action={addressAction}
          fields={fields}
          hidden={address ? { id: address.id } : {}}
          label="Save address"
        />
        {address ? (
          <Link className="mt-4 inline-block underline" href="/account/addresses">
            Cancel editing
          </Link>
        ) : null}
      </section>
    </>
  );
}
