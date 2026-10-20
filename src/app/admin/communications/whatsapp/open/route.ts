import { revalidatePath } from 'next/cache';
import { adminContext } from '@/server/admin/context';
import { openWhatsapp } from '@/server/communications/admin';
import { boundedBody } from '@/server/security/body';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// A native POST preserves the form's new-tab target; a React action navigates the current tab.
export async function POST(request: Request) {
  const { db, actor } = await adminContext(true);
  if (request.headers.get('content-type')?.split(';')[0] !== 'application/x-www-form-urlencoded')
    return new Response('Unsupported form.', { status: 415 });
  const body = await boundedBody(request, 256);
  if (body === null) return new Response('Form too large.', { status: 413 });
  try {
    const url = await openWhatsapp(db, actor, new URLSearchParams(body).get('id') || '');
    revalidatePath('/admin', 'layout');
    return new Response(null, {
      status: 303,
      headers: {
        Location: url,
        'Cache-Control': 'private, no-store',
        'Referrer-Policy': 'no-referrer',
      },
    });
  } catch {
    return new Response('Unable to open this draft. Return to the order and prepare it again.', {
      status: 400,
      headers: { 'Cache-Control': 'private, no-store' },
    });
  }
}
