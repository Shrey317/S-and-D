'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import type { FormResult } from '@/features/account/validation';
import { CheckoutError } from '@/features/checkout/rules';
import { adminContext } from './context';
import {
  saveProduct,
  saveCategory,
  saveVariant,
  adjustStock,
  completeOrder,
  cancelLegacyOrder,
  addOrderNote,
  saveSettings,
  approveAddress,
  savePromotion,
} from './repository';
function fields(form: FormData, checkboxes: string[] = []) {
  const data: Record<string, unknown> = Object.fromEntries(form);
  for (const key of checkboxes) data[key] = form.get(key) === 'on';
  return data;
}
function fail(error: unknown): FormResult {
  return {
    status: 'error',
    message:
      error instanceof CheckoutError
        ? error.message
        : error instanceof z.ZodError
          ? 'Check the fields, dates and reason, then try again.'
          : 'Unable to save. Check for duplicate identifiers and refresh before trying again.',
  };
}
function refresh() {
  revalidatePath('/admin', 'layout');
  revalidatePath('/', 'layout');
}
export async function productAction(_: FormResult, form: FormData): Promise<FormResult> {
  const { db, actor } = await adminContext(true);
  let id: string;
  try {
    id = await saveProduct(db, actor, fields(form, ['featured', 'isSample']));
    refresh();
  } catch (e) {
    return fail(e);
  }
  redirect(`/admin/products/${id}`);
}
export async function categoryAction(_: FormResult, form: FormData): Promise<FormResult> {
  const { db, actor } = await adminContext(true);
  try {
    await saveCategory(db, actor, fields(form, ['active']));
    refresh();
    return { status: 'success', message: 'Category saved.' };
  } catch (e) {
    return fail(e);
  }
}
export async function variantAction(_: FormResult, form: FormData): Promise<FormResult> {
  const { db, actor } = await adminContext(true);
  try {
    await saveVariant(db, actor, fields(form, ['active']));
    refresh();
    return { status: 'success', message: 'Variant saved. Adjust physical stock in Inventory.' };
  } catch (e) {
    return fail(e);
  }
}
export async function stockAction(_: FormResult, form: FormData): Promise<FormResult> {
  const { db, actor } = await adminContext(true);
  try {
    await adjustStock(db, actor, fields(form));
    refresh();
    return { status: 'success', message: 'Stock correction recorded.' };
  } catch (e) {
    return fail(e);
  }
}
export async function completeAction(_: FormResult, form: FormData): Promise<FormResult> {
  const { db, actor } = await adminContext(true);
  try {
    await completeOrder(db, actor, String(form.get('orderId')), String(form.get('reason')));
    refresh();
    return { status: 'success', message: 'Fulfilment completed and held stock consumed.' };
  } catch (e) {
    return fail(e);
  }
}
export async function cancelLegacyAction(_: FormResult, form: FormData): Promise<FormResult> {
  const { db, actor } = await adminContext(true);
  try {
    await cancelLegacyOrder(db, actor, String(form.get('orderId')), String(form.get('reason')));
    refresh();
    return { status: 'success', message: 'Test order cancelled and held stock released.' };
  } catch (e) {
    return fail(e);
  }
}
export async function noteAction(_: FormResult, form: FormData): Promise<FormResult> {
  const { db, actor } = await adminContext(true);
  try {
    await addOrderNote(db, actor, String(form.get('orderId')), String(form.get('text')));
    refresh();
    return { status: 'success', message: 'Internal note added.' };
  } catch (e) {
    return fail(e);
  }
}
export async function settingsAction(_: FormResult, form: FormData): Promise<FormResult> {
  const { db, actor } = await adminContext(true);
  try {
    await saveSettings(
      db,
      actor,
      fields(form, ['collectionEnabled', 'deliveryEnabled', 'suspended', 'sameDayEnabled']),
    );
    refresh();
    return {
      status: 'success',
      message:
        'Settings saved. Existing delivery addresses require approval against the new rules.',
    };
  } catch (e) {
    return fail(e);
  }
}
export async function approvalAction(_: FormResult, form: FormData): Promise<FormResult> {
  const { db, actor } = await adminContext(true);
  try {
    await approveAddress(
      db,
      actor,
      String(form.get('addressId')),
      `${String(form.get('expiresAt'))}+02:00`,
      String(form.get('reason')),
      form.get('approved') === 'on',
    );
    refresh();
    return { status: 'success', message: 'Delivery approval updated for this exact address.' };
  } catch (e) {
    return fail(e);
  }
}
export async function promotionAction(_: FormResult, form: FormData): Promise<FormResult> {
  const { db, actor } = await adminContext(true);
  let id: string;
  try {
    const data = fields(form, ['active']);
    for (const key of ['startsAt', 'endsAt']) data[key] = `${data[key]}:00+02:00`;
    id = await savePromotion(db, actor, data);
    refresh();
  } catch (e) {
    return fail(e);
  }
  redirect(`/admin/promotions/${id}`);
}
