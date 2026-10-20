import 'server-only';
import { redirect } from 'next/navigation';
import { createAuthClient } from './client';
import { serverEnv } from '@/config/env.server';
import { safeReturnTo } from '@/features/account/validation';
import { hasAdministratorGrant } from '@/server/account/repository';
import { getAccountDatabase } from '@/server/db/account-client';

export async function getIdentity() {
  if (!serverEnv.AUTH_ENABLED) return null;
  const auth = await createAuthClient();
  // Network validation also checks deleted/disabled users. Never authorize from getSession().
  const { data, error } = await auth.auth.getUser();
  if (
    error ||
    !data.user ||
    !data.user.email_confirmed_at ||
    data.user.is_anonymous ||
    !data.user.email
  )
    return null;
  let mfaRequired = false;
  if (data.user.factors?.some((factor) => factor.status === 'verified')) {
    const { data: verified, error: claimsError } = await auth.auth.getClaims();
    if (claimsError || verified?.claims.sub !== data.user.id) return null;
    mfaRequired = verified.claims.aal !== 'aal2';
  }
  return { id: data.user.id, email: data.user.email, mfaRequired };
}
export async function requireIdentity(returnTo = '/account', allowPendingMfa = false) {
  const identity = await getIdentity();
  if (!identity) redirect(`/auth/sign-in?next=${encodeURIComponent(safeReturnTo(returnTo))}`);
  if (identity.mfaRequired && !allowPendingMfa) redirect('/auth/mfa');
  return identity;
}
export async function isAdministrator() {
  const identity = await getIdentity();
  if (!identity) return false;
  const auth = await createAuthClient();
  const { data, error } = await auth.auth.getClaims();
  if (error || data?.claims.sub !== identity.id || data.claims.aal !== 'aal2') return false;
  return hasAdministratorGrant(await getAccountDatabase(), identity.id);
}
