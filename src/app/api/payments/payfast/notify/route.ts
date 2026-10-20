import { serverEnv } from '@/config/env.server';
import { getPaymentDatabase } from '@/server/db/payment-client';
import { payfastConfig } from '@/server/payments/config';
import {
  verifyNotification,
  payfastSourceAllowed,
  confirmPayfast,
  NotificationError,
} from '@/server/payments/payfast';
import { applyNotification } from '@/server/payments/repository';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  const response = (text: string, status: number) =>
    new Response(text, {
      status,
      headers: { 'Cache-Control': 'no-store', 'Content-Type': 'text/plain' },
    });
  if (!serverEnv.PAYFAST_ENABLED || !serverEnv.PAYMENTS_ENABLED)
    return response('Unavailable', 503);
  // Only the verified hosting edge may supply the peer address. Local/unknown proxies fail closed.
  if (serverEnv.PAYFAST_TRUSTED_PROXY !== 'netlify' || process.env.NETLIFY !== 'true')
    return response('Notification source is not configured', 503);
  if (
    !request.headers
      .get('content-type')
      ?.toLowerCase()
      .startsWith('application/x-www-form-urlencoded')
  )
    return response('Unsupported content type', 415);
  const reader = request.body?.getReader();
  if (!reader) return response('Invalid notification', 400);
  let bytes = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.length;
      if (bytes > 16384) {
        await reader.cancel();
        return response('Payload too large', 413);
      }
      chunks.push(part.value);
    }
    const notification = await verifyNotification(
      Buffer.concat(chunks).toString('utf8'),
      request.headers.get('x-nf-client-connection-ip') || undefined,
      payfastConfig(),
      { sourceAllowed: payfastSourceAllowed, confirm: confirmPayfast },
    );
    await applyNotification(await getPaymentDatabase(), notification);
    // Acknowledge only after durable processing. Transient errors remain retryable.
    return response('OK', 200);
  } catch (error) {
    if (error instanceof NotificationError) return response('Invalid notification', 400);
    return response('Payment processing temporarily unavailable', 503);
  }
}
