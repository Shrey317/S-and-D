import 'server-only';
import { serverEnv } from '@/config/env.server';
import type { PaymentMethod } from '@/features/payments/methods';
export function enabledPaymentMethods(): PaymentMethod[] {
  const methods: PaymentMethod[] = ['TEST'];
  if (!serverEnv.PAYMENTS_ENABLED) return methods;
  methods.push('COLLECTION', 'COD');
  if (serverEnv.MANUAL_EFT_ENABLED) methods.push('MANUAL_EFT');
  if (serverEnv.PAYFAST_ENABLED) {
    methods.push('PAYFAST_CARD');
    if (serverEnv.PAYFAST_INSTANT_EFT_ENABLED) methods.push('PAYFAST_EFT');
  }
  return methods;
}
export function payfastConfig() {
  if (
    !serverEnv.PAYFAST_ENABLED ||
    !serverEnv.PAYMENTS_ENABLED ||
    serverEnv.PAYFAST_MODE !== 'sandbox'
  )
    throw new Error('Payfast sandbox is not configured.');
  return {
    merchantId: serverEnv.PAYFAST_MERCHANT_ID!,
    merchantKey: serverEnv.PAYFAST_MERCHANT_KEY!,
    passphrase: serverEnv.PAYFAST_PASSPHRASE!,
    siteUrl: serverEnv.NEXT_PUBLIC_SITE_URL,
  };
}
