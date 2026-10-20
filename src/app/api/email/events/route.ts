import { serverEnv } from '@/config/env.server';
import { getCommunicationsDatabase } from '@/server/db/communications-client';
import { verifiedDelivery, recordDelivery } from '@/server/communications/delivery';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  const reply = (status: number) =>
    new Response(null, { status, headers: { 'Cache-Control': 'no-store' } });
  if (!serverEnv.EMAIL_ENABLED || !serverEnv.RESEND_WEBHOOK_SECRET) return reply(503);
  if (!request.headers.get('content-type')?.startsWith('application/json')) return reply(415);
  let event: ReturnType<typeof verifiedDelivery>;
  try {
    const reader = request.body?.getReader();
    if (!reader) return reply(400);
    const chunks: Uint8Array[] = [];
    let length = 0;
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      length += part.value.length;
      if (length > 65536) {
        await reader.cancel();
        return reply(413);
      }
      chunks.push(part.value);
    }
    event = verifiedDelivery(
      Buffer.concat(chunks).toString('utf8'),
      request.headers,
      serverEnv.RESEND_WEBHOOK_SECRET,
    );
  } catch {
    return reply(400);
  }
  try {
    if (event) await recordDelivery(await getCommunicationsDatabase(), event);
    return reply(204);
  } catch {
    return reply(503);
  }
}
