'use client';
import Link from 'next/link';
import { useActionState, useState } from 'react';
import { checkoutAction } from '@/server/checkout/actions';
import { initialFormResult } from '@/features/account/validation';
import { POLICY_VERSION } from '@/features/checkout/rules';
import { Button } from '@/components/ui/button';
import { paymentLabels, compatibleMethod, type PaymentMethod } from '@/features/payments/methods';
export function CheckoutForm({
  checkoutKey,
  quote,
  addresses,
  name,
  phone,
  enabled,
  paymentMethods,
  promotionCode = '',
}: {
  checkoutKey: string;
  quote: string;
  addresses: { id: string; label: string; street: string }[];
  name: string;
  phone: string;
  enabled: boolean;
  paymentMethods: PaymentMethod[];
  promotionCode?: string;
}) {
  const [state, action, pending] = useActionState(checkoutAction, initialFormResult);
  const [method, setMethod] = useState('COLLECTION');
  const field = 'mt-2 min-h-12 w-full rounded-lg border bg-card px-4';
  return (
    <form action={action} className="grid gap-6">
      <input type="hidden" name="key" value={checkoutKey} />
      <input type="hidden" name="quote" value={quote} />
      <input type="hidden" name="policyVersion" value={POLICY_VERSION} />
      <input type="hidden" name="promotionCode" value={promotionCode} />
      <label className="font-semibold">
        Contact name
        <input
          name="name"
          autoComplete="name"
          required
          minLength={2}
          maxLength={100}
          defaultValue={name}
          className={field}
        />
      </label>
      <label className="font-semibold">
        Phone number
        <input
          name="phone"
          type="tel"
          autoComplete="tel"
          required
          maxLength={20}
          defaultValue={phone}
          className={field}
        />
      </label>
      <fieldset>
        <legend className="font-semibold">How would you like your order?</legend>
        <div className="mt-3 grid gap-3">
          {[
            ['COLLECTION', 'Collect from 155 Gemsbok Street'],
            ['DELIVERY', 'Delivery to an approved address'],
          ].map(([value, label]) => (
            <label key={value} className="flex min-h-12 items-center gap-3 rounded-lg border p-4">
              <input
                type="radio"
                name="method"
                value={value}
                checked={method === value}
                onChange={() => setMethod(value!)}
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      {method === 'DELIVERY' && (
        <div>
          <label className="font-semibold">
            Saved delivery address
            <select name="addressId" required className={field} defaultValue="">
              <option value="">Choose an address</option>
              {addresses.map((address) => (
                <option key={address.id} value={address.id}>
                  {address.label} — {address.street}
                </option>
              ))}
            </select>
          </label>
          <p className="mt-3 text-sm">
            Delivery is free only after the store approves the exact address. A Lenasia suburb or
            postcode alone does not establish eligibility.
          </p>
          <Link className="mt-3 inline-block underline" href="/account/addresses?next=checkout">
            Add or edit an address
          </Link>
        </div>
      )}
      <div className="rounded-xl bg-secondary p-5">
        <h2 className="font-semibold">Payment</h2>
        <label className="mt-3 block font-semibold">
          Payment method
          <select
            key={method}
            name="paymentMethod"
            className={field}
            defaultValue={
              paymentMethods.includes('COLLECTION') && method === 'COLLECTION'
                ? 'COLLECTION'
                : 'TEST'
            }
          >
            {paymentMethods
              .filter((payment) => compatibleMethod(payment, method as 'DELIVERY' | 'COLLECTION'))
              .map((payment) => (
                <option value={payment} key={payment}>
                  {paymentLabels[payment]}
                </option>
              ))}
          </select>
        </label>
        <p className="mt-2">
          Local test order only. Do not transfer real money. Payfast uses its sandbox wallet;
          offline methods remain unpaid until a verified receipt is recorded. This test order will
          not be fulfilled.
        </p>
      </div>
      <label className="flex items-start gap-3">
        <input type="checkbox" name="accepted" required className="mt-1 size-5 shrink-0" />
        <span>
          I understand this is a local test order, not a purchase. I have read the{' '}
          <Link href="/policies" className="underline">
            policy status
          </Link>{' '}
          and{' '}
          <Link href="/delivery-and-collection" className="underline">
            delivery and collection information
          </Link>
          .
        </span>
      </label>
      <Button type="submit" disabled={!enabled || pending}>
        {pending ? 'Creating test order…' : 'Create local test order'}
      </Button>
      <p role={state.status === 'error' ? 'alert' : 'status'}>{state.message}</p>
      {state.status === 'error' && (
        <a className="underline" href="/checkout">
          Refresh checkout to review changes
        </a>
      )}
    </form>
  );
}
