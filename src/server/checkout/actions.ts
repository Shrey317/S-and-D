'use server';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { serverEnv } from '@/config/env.server';
import { requireIdentity } from '@/server/auth/identity';
import { getCommerceDatabase } from '@/server/db/commerce-client';
import { CheckoutError, checkoutSchema } from '@/features/checkout/rules';
import type { FormResult } from '@/features/account/validation';
import { basketContext } from './service';
import { changeBasket, placeOrder, reorder, readBasket } from './repository';
import { enabledPaymentMethods } from '@/server/payments/config';
async function origin() {
  if ((await headers()).get('origin') !== new URL(serverEnv.NEXT_PUBLIC_SITE_URL).origin)
    throw new Error('Invalid origin.');
}
function failed(error: unknown): FormResult {
  return {
    status: 'error',
    message:
      error instanceof CheckoutError
        ? error.message
        : 'Unable to save. Check your details and try again.',
  };
}
export async function basketAction(_: FormResult, form: FormData): Promise<FormResult> {
  await origin();
  try {
    const { db, owner } = await basketContext(true);
    const notices = await changeBasket(
      db,
      owner,
      String(form.get('variantId')),
      Number(form.get('quantity')),
      form.get('mode') === 'set' ? 'set' : 'add',
      serverEnv.CATALOG_ALLOW_SAMPLES,
    );
    revalidatePath('/cart');
    revalidatePath('/checkout');
    return { status: 'success', message: ['Basket updated.', ...notices].join(' ') };
  } catch (error) {
    return failed(error);
  }
}
export async function checkoutAction(_: FormResult, form: FormData): Promise<FormResult> {
  const identity = await requireIdentity('/checkout');
  await origin();
  if (!serverEnv.LOCAL_CHECKOUT_ENABLED)
    return { status: 'error', message: 'Online ordering is not open yet.' };
  const parsed = checkoutSchema.safeParse({
    ...Object.fromEntries(form),
    accepted: form.get('accepted') === 'on',
    addressId: form.get('addressId') || undefined,
    paymentMethod: form.get('paymentMethod') || 'TEST',
  });
  if (!parsed.success)
    return {
      status: 'error',
      message: 'Complete your contact details and accept the local test-order acknowledgement.',
    };
  let id: string;
  if (!enabledPaymentMethods().includes(parsed.data.paymentMethod))
    return {
      status: 'error',
      message: 'This payment method is not configured. Choose another method.',
    };
  try {
    id = await placeOrder(
      await getCommerceDatabase(),
      identity.id,
      identity.email,
      parsed.data,
      serverEnv.CATALOG_ALLOW_SAMPLES,
    );
  } catch (error) {
    return failed(error);
  }
  revalidatePath('/cart');
  revalidatePath('/account/orders');
  redirect(`/checkout/confirmation/${id}`);
}
export async function reorderAction(_: FormResult, form: FormData): Promise<FormResult> {
  const identity = await requireIdentity('/account/orders');
  await origin();
  try {
    const { db, owner } = await basketContext();
    await readBasket(db, owner, serverEnv.CATALOG_ALLOW_SAMPLES);
    const notices = await reorder(
      db,
      identity.id,
      String(form.get('orderId')),
      serverEnv.CATALOG_ALLOW_SAMPLES,
    );
    revalidatePath('/cart');
    return { status: 'success', message: notices.join(' ') };
  } catch (error) {
    return failed(error);
  }
}
