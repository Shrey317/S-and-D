'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import type { FormResult } from '@/features/account/validation';
import { adminContext } from '@/server/admin/context';
import { prepareWhatsapp, markWhatsapp, resendNotice, readNotification } from './admin';
import { processMail } from './run';
import { serverEnv } from '@/config/env.server';
import { CheckoutError } from '@/features/checkout/rules';
const fail = (e: unknown): FormResult => ({
  status: 'error',
  message:
    e instanceof CheckoutError
      ? e.message
      : 'Unable to complete this action. Refresh and check the fields.',
});
const refresh = () => revalidatePath('/admin', 'layout');
export async function prepareAction(_: FormResult, form: FormData): Promise<FormResult> {
  const { db, actor } = await adminContext(true);
  let id: string;
  try {
    id = await prepareWhatsapp(db, actor, String(form.get('orderId')), String(form.get('key')));
    refresh();
  } catch (e) {
    return fail(e);
  }
  redirect(`/admin/communications/whatsapp/${id}`);
}
export async function markAction(_: FormResult, form: FormData): Promise<FormResult> {
  const { db, actor } = await adminContext(true);
  try {
    await markWhatsapp(
      db,
      actor,
      String(form.get('id')),
      form.get('confirmed') === 'on',
      String(form.get('reason')),
    );
    refresh();
    return {
      status: 'success',
      message: 'Manual sending recorded. Recipient delivery is unverified.',
    };
  } catch (e) {
    return fail(e);
  }
}
export async function resendAction(_: FormResult, form: FormData): Promise<FormResult> {
  const { db, actor } = await adminContext(true);
  try {
    await resendNotice(
      db,
      actor,
      String(form.get('id')),
      String(form.get('key')),
      form.get('confirmed') === 'on',
    );
    refresh();
    return {
      status: 'success',
      message: 'Additional copy queued. This does not confirm sending or delivery.',
    };
  } catch (e) {
    return fail(e);
  }
}
export async function readAction(_: FormResult, form: FormData): Promise<FormResult> {
  const { db, actor } = await adminContext(true);
  try {
    await readNotification(db, actor, String(form.get('id')));
    refresh();
    return { status: 'success', message: 'Notification acknowledged.' };
  } catch (e) {
    return fail(e);
  }
}
export async function captureAction(): Promise<void> {
  await adminContext(true);
  if (
    !serverEnv.EMAIL_CAPTURE_ENABLED ||
    !['development', 'test'].includes(serverEnv.APP_ENV) ||
    serverEnv.EMAIL_ENABLED
  )
    throw new Error('Local capture only.');
  await processMail(10);
  refresh();
}
