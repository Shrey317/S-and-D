import { createHash, timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';
import { z } from 'zod';
import { cents } from '@/features/checkout/rules';

export const PAYFAST_SANDBOX = 'https://sandbox.payfast.co.za';
export type PayfastConfig = {
  merchantId: string;
  merchantKey: string;
  passphrase: string;
  siteUrl: string;
};
export const phpEncode = (value: string) =>
  encodeURIComponent(value)
    .replace(/[!'()*~]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
    .replace(/%20/g, '+');
const md5 = (value: string) => createHash('md5').update(value, 'utf8').digest('hex');
export function requestSignature(fields: Record<string, string>, passphrase: string) {
  const canonical = Object.entries(fields)
    .filter(([, value]) => value !== '')
    .map(([key, value]) => `${key}=${phpEncode(value.trim())}`)
    .join('&');
  return md5(`${canonical}&passphrase=${phpEncode(passphrase.trim())}`);
}
export function paymentRequest(
  config: PayfastConfig,
  payment: { id: string; amount: string; method: string },
): { url: string; fields: Record<string, string> } {
  if (cents(payment.amount) < 500n) throw new Error('Payfast requires at least R5.00.');
  const origin = new URL(config.siteUrl).origin;
  // Public merchant identifiers are required by Payfast's hosted form protocol. The passphrase never leaves the server.
  const fields: Record<string, string> = {
    merchant_id: config.merchantId,
    merchant_key: config.merchantKey,
    return_url: `${origin}/payments/${payment.id}/status?return=success`,
    cancel_url: `${origin}/payments/${payment.id}/status?return=cancel`,
    notify_url: `${origin}/api/payments/payfast/notify`,
    m_payment_id: payment.id,
    amount: payment.amount,
    item_name: `S & D test order ${payment.id}`,
    payment_method: payment.method === 'PAYFAST_EFT' ? 'ef' : 'cc',
  };
  return {
    url: `${PAYFAST_SANDBOX}/eng/process`,
    fields: { ...fields, signature: requestSignature(fields, config.passphrase) },
  };
}
export class NotificationError extends Error {
  constructor(public code: string) {
    super('Payment notification rejected.');
  }
}
export type VerifiedNotification = {
  paymentId: string;
  providerId: string;
  status: 'COMPLETE' | 'FAILED' | 'CANCELLED' | 'PENDING';
  amount: string;
  eventKey: string;
};
export type VerificationDependencies = {
  sourceAllowed: (ip: string) => Promise<boolean>;
  confirm: (canonical: string) => Promise<boolean>;
};
export async function verifyNotification(
  raw: string,
  sourceIp: string | undefined,
  config: PayfastConfig,
  dependencies: VerificationDependencies,
): Promise<VerifiedNotification> {
  if (Buffer.byteLength(raw) > 16384 || !sourceIp || !isIP(sourceIp))
    throw new NotificationError('SOURCE');
  const entries = [...new URLSearchParams(raw)];
  if (
    !entries.length ||
    entries.length > 60 ||
    new Set(entries.map(([k]) => k)).size !== entries.length ||
    entries.some(([k, v]) => !/^[a-z0-9_]{1,50}$/.test(k) || v.length > 1000) ||
    entries.at(-1)?.[0] !== 'signature'
  )
    throw new NotificationError('FORMAT');
  const fields = Object.fromEntries(entries),
    signature = fields.signature || '';
  const canonical = entries
    .filter(([key]) => key !== 'signature')
    .map(([key, value]) => `${key}=${phpEncode(value)}`)
    .join('&');
  const expected = md5(`${canonical}&passphrase=${phpEncode(config.passphrase)}`);
  if (
    !/^[a-f0-9]{32}$/.test(signature) ||
    !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  )
    throw new NotificationError('SIGNATURE');
  if (fields.merchant_id !== config.merchantId) throw new NotificationError('MERCHANT');
  if (
    !z.uuid().safeParse(fields.m_payment_id).success ||
    !/^[0-9]{1,40}$/.test(fields.pf_payment_id || '') ||
    !['COMPLETE', 'FAILED', 'CANCELLED', 'PENDING'].includes(fields.payment_status || '') ||
    !/^\d{1,12}\.\d{2}$/.test(fields.amount_gross || '')
  )
    throw new NotificationError('FIELDS');
  if (!(await dependencies.sourceAllowed(sourceIp))) throw new NotificationError('SOURCE');
  if (!(await dependencies.confirm(canonical))) throw new NotificationError('CONFIRMATION');
  return {
    paymentId: fields.m_payment_id!,
    providerId: fields.pf_payment_id!,
    status: fields.payment_status as VerifiedNotification['status'],
    amount: fields.amount_gross!,
    eventKey: createHash('sha256').update(canonical).digest('hex'),
  };
}
// Official Payfast address ranges, checked 17 October 2026. No Referer or client-supplied forwarded-for trust.
export async function payfastSourceAllowed(ip: string) {
  const normalized = ip.startsWith('::ffff:') ? ip.slice(7) : ip;
  if (isIP(normalized) !== 4) return false;
  const parts = normalized.split('.').map(Number);
  const prefix = parts.slice(0, 3).join('.'),
    last = parts[3]!;
  return (
    (prefix === '197.97.145' && last >= 144 && last <= 159) ||
    (prefix === '41.74.179' && last >= 192 && last <= 223) ||
    (prefix === '102.216.36' && (last <= 15 || (last >= 128 && last <= 143))) ||
    normalized === '144.126.193.139'
  );
}
export async function confirmPayfast(canonical: string) {
  const response = await fetch(`${PAYFAST_SANDBOX}/eng/query/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: canonical,
    cache: 'no-store',
    redirect: 'error',
    signal: AbortSignal.timeout(10000),
  });
  return response.ok && (await response.text()).trim() === 'VALID';
}
