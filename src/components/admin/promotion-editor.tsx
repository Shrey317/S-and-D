import type { Promotion } from '@/generated/prisma/client';
import { ActionForm } from '@/components/account/action-form';
import { promotionAction } from '@/server/admin/actions';
import { reasonField, options } from './ui';
const localDate = (date: Date) => new Date(date.getTime() + 7200000).toISOString().slice(0, 16);
export function PromotionEditor({
  promotion: p,
  products,
  variants,
}: {
  promotion?: Promotion | undefined;
  products: { id: string; name: string }[];
  variants: { id: string; label: string; product: { name: string } }[];
}) {
  const bundle = (p?.bundle || []) as { variantId: string; quantity: number }[];
  return (
    <ActionForm
      action={promotionAction}
      hidden={{ version: String(p?.version || 0), ...(p ? { id: p.id } : {}) }}
      label="Save promotion"
      fields={[
        { name: 'name', label: 'Promotion name', required: true, value: p?.name },
        {
          name: 'code',
          label: 'Optional code (blank applies automatically)',
          value: p?.code || '',
          maxLength: 40,
        },
        {
          name: 'kind',
          label: 'Discount type',
          type: 'select',
          value: p?.kind || 'PERCENT',
          options: options(['PERCENT', 'FIXED', 'BUNDLE']),
        },
        {
          name: 'value',
          label: 'Percentage or discount in ZAR (two decimals)',
          required: true,
          pattern: '[0-9]+[.][0-9]{2}',
          value: p?.value.toFixed(2),
        },
        {
          name: 'productId',
          label: 'Product special (percentage/fixed only; blank means whole basket)',
          type: 'select',
          value: p?.productId || '',
          options: [
            { value: '', label: 'Whole basket' },
            ...products.map((p) => ({ value: p.id, label: p.name })),
          ],
        },
        {
          name: 'variantA',
          label: 'Bundle first variant (bundle only)',
          type: 'select',
          value: bundle[0]?.variantId || '',
          options: [
            { value: '', label: 'Choose variant' },
            ...variants.map((v) => ({ value: v.id, label: `${v.product.name} · ${v.label}` })),
          ],
        },
        {
          name: 'quantityA',
          label: 'First variant packs per bundle',
          type: 'number',
          value: String(bundle[0]?.quantity || 1),
          required: true,
        },
        {
          name: 'variantB',
          label: 'Bundle second variant (bundle only)',
          type: 'select',
          value: bundle[1]?.variantId || '',
          options: [
            { value: '', label: 'Choose variant' },
            ...variants.map((v) => ({ value: v.id, label: `${v.product.name} · ${v.label}` })),
          ],
        },
        {
          name: 'quantityB',
          label: 'Second variant packs per bundle',
          type: 'number',
          value: String(bundle[1]?.quantity || 1),
          required: true,
        },
        {
          name: 'startsAt',
          label: 'Starts (Johannesburg time)',
          type: 'datetime-local',
          required: true,
          value: p ? localDate(p.startsAt) : undefined,
        },
        {
          name: 'endsAt',
          label: 'Ends (Johannesburg time)',
          type: 'datetime-local',
          required: true,
          value: p ? localDate(p.endsAt) : undefined,
        },
        {
          name: 'maxUses',
          label: 'Total order redemption limit',
          type: 'number',
          required: true,
          value: String(p?.maxUses || 100),
        },
        {
          name: 'perCustomer',
          label: 'Orders per customer limit',
          type: 'number',
          required: true,
          value: String(p?.perCustomer || 1),
        },
        {
          name: 'active',
          label: 'Active during these dates',
          type: 'checkbox',
          checked: p?.active ?? false,
        },
        reasonField,
      ]}
    />
  );
}
