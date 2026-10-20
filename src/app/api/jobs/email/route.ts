import { timingSafeEqual } from 'node:crypto';
import { serverEnv } from '@/config/env.server';
import { processMail } from '@/server/communications/run';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  const secret = serverEnv.COMMUNICATIONS_WORKER_TOKEN;
  if (!secret) return new Response(null, { status: 503 });
  const expected = Buffer.from(`Bearer ${secret}`),
    actual = Buffer.from(request.headers.get('authorization') || '');
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual))
    return new Response(null, { status: 401 });
  try {
    return Response.json(await processMail(), { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return new Response(null, { status: 503 });
  }
}
