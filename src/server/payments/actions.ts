'use server';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { notFound } from 'next/navigation';
import { serverEnv } from '@/config/env.server';
import { isAdministrator, requireIdentity } from '@/server/auth/identity';
import { getPaymentDatabase } from '@/server/db/payment-client';
import { getAccountDatabase } from '@/server/db/account-client';
import { consumeAuthLimit } from '@/server/auth/rate-limit';
import type { FormResult } from '@/features/account/validation';
import { CheckoutError } from '@/features/checkout/rules';
import {
  recordReceiptSchema,
  recordVerifiedReceipt,
  refundRequestSchema,
  requestRefund,
  resolveRefund,
  cancelAllocation,
} from './repository';
async function context() {
  const identity = await requireIdentity();
  if (!(await isAdministrator())) notFound();
  if ((await headers()).get('origin') !== new URL(serverEnv.NEXT_PUBLIC_SITE_URL).origin)
    throw new Error('Invalid origin.');
  if (
    !(await consumeAuthLimit(
      await getAccountDatabase(),
      serverEnv.AUTH_RATE_LIMIT_SECRET!,
      `payment-admin:${identity.id}`,
      30,
      60,
    ))
  )
    throw new Error('Too many requests.');
  return { db: await getPaymentDatabase(), actorId: identity.id };
}
function failure(error: unknown): FormResult {
  return {
    status: 'error',
    message:
      error instanceof CheckoutError
        ? error.message
        : 'Unable to record this action. Check the details and reference, then try again.',
  };
}
function refresh() {
  revalidatePath('/admin/payments', 'layout');
  revalidatePath('/payments', 'layout');
  revalidatePath('/account/orders', 'layout');
}
export async function receiptAction(_: FormResult, form: FormData): Promise<FormResult> {
  const { db, actorId } = await context();
  try {
    const data = recordReceiptSchema.parse({
      ...Object.fromEntries(form),
      verified: form.get('verified') === 'on',
    });
    await recordVerifiedReceipt(db, actorId, data);
    refresh();
    return {
      status: 'success',
      message: 'Verified receipt recorded. Review any payment exception before fulfilment.',
    };
  } catch (error) {
    return failure(error);
  }
}
export async function refundRequestAction(_: FormResult, form: FormData): Promise<FormResult> {
  const { db, actorId } = await context();
  try {
    await requestRefund(db, actorId, refundRequestSchema.parse(Object.fromEntries(form)));
    refresh();
    return {
      status: 'success',
      message: 'Refund requested. No money has been returned by this action.',
    };
  } catch (error) {
    return failure(error);
  }
}
export async function refundResolveAction(_: FormResult, form: FormData): Promise<FormResult> {
  const { db, actorId } = await context();
  try {
    const action = form.get('resolution');
    if (action !== 'COMPLETE' && action !== 'CANCEL')
      throw new CheckoutError('Choose a valid refund action.');
    if (action === 'COMPLETE' && form.get('verified') !== 'on')
      throw new CheckoutError('Verify external completion before recording it.');
    await resolveRefund(
      db,
      actorId,
      String(form.get('refundId')),
      action,
      String(form.get('reference') || ''),
      String(form.get('reason')),
    );
    refresh();
    return {
      status: 'success',
      message:
        action === 'COMPLETE'
          ? 'Externally completed refund recorded.'
          : 'Refund request cancelled.',
    };
  } catch (error) {
    return failure(error);
  }
}
export async function cancelPaymentAction(_: FormResult, form: FormData): Promise<FormResult> {
  const { db, actorId } = await context();
  try {
    await cancelAllocation(db, actorId, String(form.get('paymentId')), String(form.get('reason')));
    refresh();
    return {
      status: 'success',
      message: 'Order allocation cancelled and remaining held stock released.',
    };
  } catch (error) {
    return failure(error);
  }
}
