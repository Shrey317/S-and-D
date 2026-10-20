'use server';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { requireIdentity } from '@/server/auth/identity';
import { getAccountDatabase } from '@/server/db/account-client';
import { serverEnv } from '@/config/env.server';
import { consumeAuthLimit } from '@/server/auth/rate-limit';
import { saveProfile, saveAddress, deleteAddress, setWishlist } from './repository';
import { addressSchema, type FormResult } from '@/features/account/validation';

async function context(returnTo: string) {
  const identity = await requireIdentity(returnTo);
  if ((await headers()).get('origin') !== new URL(serverEnv.NEXT_PUBLIC_SITE_URL).origin)
    throw new Error('Origin');
  const db = await getAccountDatabase();
  if (
    !(await consumeAuthLimit(
      db,
      serverEnv.AUTH_RATE_LIMIT_SECRET!,
      `account:${identity.id}`,
      40,
      60,
    ))
  )
    throw new Error('Limit');
  return { db, id: identity.id };
}
const failed: FormResult = {
  status: 'error',
  message:
    'Unable to save. Check the fields and try again. Addresses are limited to 10 and wishlist products to 100.',
};
export async function profileAction(_: FormResult, form: FormData): Promise<FormResult> {
  const { db, id } = await context('/account/profile');
  try {
    await saveProfile(db, id, { name: form.get('name'), phone: form.get('phone') });
  } catch {
    return failed;
  }
  revalidatePath('/account');
  return { status: 'success', message: 'Profile saved.' };
}
export async function addressAction(_: FormResult, form: FormData): Promise<FormResult> {
  const { db, id } = await context('/account/addresses');
  const values = Object.fromEntries(form);
  const input = addressSchema.safeParse({
    ...values,
    id: values.id || undefined,
    isDefault: values.isDefault === 'on',
  });
  if (!input.success) return failed;
  try {
    await saveAddress(db, id, input.data);
  } catch {
    return failed;
  }
  revalidatePath('/account/addresses');
  return {
    status: 'success',
    message: 'Address saved. Delivery eligibility is checked at checkout.',
  };
}
export async function removeAddressAction(_: FormResult, form: FormData): Promise<FormResult> {
  const { db, id } = await context('/account/addresses');
  try {
    await deleteAddress(db, id, String(form.get('id')));
  } catch {
    return failed;
  }
  revalidatePath('/account/addresses');
  return { status: 'success', message: 'Address removed.' };
}
export async function wishlistAction(_: FormResult, form: FormData): Promise<FormResult> {
  const { db, id } = await context('/account/wishlist');
  const saved = form.get('saved') === 'true';
  try {
    await setWishlist(
      db,
      id,
      String(form.get('productId')),
      saved,
      serverEnv.CATALOG_ALLOW_SAMPLES,
    );
  } catch {
    return failed;
  }
  revalidatePath('/account/wishlist');
  return {
    status: 'success',
    message: saved ? 'Saved to your wishlist.' : 'Removed from your wishlist.',
  };
}
