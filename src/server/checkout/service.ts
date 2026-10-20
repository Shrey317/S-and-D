import 'server-only';
import { cookies } from 'next/headers';
import { randomBytes } from 'node:crypto';
import { getIdentity } from '@/server/auth/identity';
import { getCommerceDatabase } from '@/server/db/commerce-client';
import { serverEnv } from '@/config/env.server';
import { hash, readBasket, expireReservations, type Owner } from './repository';
export const CART_COOKIE = 'sd_guest_cart';
export async function basketContext(create = false) {
  const db = await getCommerceDatabase();
  const identity = await getIdentity();
  const jar = await cookies();
  let token = jar.get(CART_COOKIE)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) token = undefined;
  const owner: Owner = {
    ...(identity && !identity.mfaRequired ? { customerId: identity.id } : {}),
    ...(token ? { guestHash: hash(token) } : {}),
  };
  if (create && !owner.customerId) {
    const stale = owner.guestHash
      ? (await readBasket(db, owner, serverEnv.CATALOG_ALLOW_SAMPLES)).guestConsumed
      : true;
    if (stale) {
      token = randomBytes(32).toString('hex');
      owner.guestHash = hash(token);
      jar.set(CART_COOKIE, token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: new URL(serverEnv.NEXT_PUBLIC_SITE_URL).protocol === 'https:',
        path: '/',
        maxAge: 30 * 86400,
      });
    }
  }
  return { db, owner };
}
export async function currentBasket(promotionCode = '') {
  if (!serverEnv.CART_ENABLED) return null;
  const { db, owner } = await basketContext();
  await expireReservations(db);
  if (!owner.customerId && !owner.guestHash) return null;
  return readBasket(db, owner, serverEnv.CATALOG_ALLOW_SAMPLES, promotionCode);
}
