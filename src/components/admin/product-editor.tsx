import { ActionForm } from '@/components/account/action-form';
import type { Product, Category, ProductVariant } from '@/generated/prisma/client';
import { productAction, variantAction } from '@/server/admin/actions';
import { reasonField, options } from './ui';
export function ProductEditor({
  product: p,
  categories,
}: {
  product?: Product;
  categories: Category[];
}) {
  return (
    <ActionForm
      action={productAction}
      hidden={p ? { id: p.id } : {}}
      label="Save product"
      fields={[
        { name: 'name', label: 'Product name', required: true, value: p?.name },
        {
          name: 'slug',
          label: 'URL slug',
          required: true,
          value: p?.slug,
          pattern: '[a-z0-9]+(-[a-z0-9]+)*',
        },
        {
          name: 'categoryId',
          label: 'Category',
          type: 'select',
          required: true,
          value: p?.categoryId,
          options: categories.map((c) => ({
            value: c.id,
            label: `${c.name}${c.active ? '' : ' (inactive)'}`,
          })),
        },
        {
          name: 'description',
          label: 'Description',
          type: 'textarea',
          required: true,
          value: p?.description,
          minLength: 5,
          maxLength: 5000,
        },
        {
          name: 'state',
          label: 'Status',
          type: 'select',
          value: p?.state || 'DRAFT',
          options: options(['DRAFT', 'ACTIVE', 'ARCHIVED']),
        },
        {
          name: 'featured',
          label: 'Featured on the storefront',
          type: 'checkbox',
          checked: p?.featured,
        },
        {
          name: 'isSample',
          label: 'Development sample — never for production sale',
          type: 'checkbox',
          checked: p?.isSample ?? true,
        },
        reasonField,
      ]}
    />
  );
}
export function VariantEditor({
  productId,
  variant: v,
}: {
  productId: string;
  variant?: ProductVariant;
}) {
  return (
    <ActionForm
      action={variantAction}
      hidden={{ productId, ...(v ? { id: v.id } : {}) }}
      label={v ? 'Save variant' : 'Add variant'}
      fields={[
        { name: 'sku', label: 'SKU', required: true, value: v?.sku },
        { name: 'label', label: 'Pack size / variant label', required: true, value: v?.label },
        {
          name: 'unit',
          label: 'Selling unit',
          type: 'select',
          value: v?.unit || 'PACK',
          options: options(['KG', 'BOX', 'PACK', 'EACH', 'BUNCH', 'BAG']),
        },
        {
          name: 'price',
          label: 'Price (ZAR, two decimals)',
          required: true,
          value: v?.price.toFixed(2),
          pattern: '[0-9]+[.][0-9]{2}',
        },
        {
          name: 'lowStockThreshold',
          label: 'Low-stock alert threshold',
          type: 'number',
          required: true,
          value: String(v?.lowStockThreshold ?? 5),
        },
        {
          name: 'active',
          label: 'Available for sale when stock permits',
          type: 'checkbox',
          checked: v?.active ?? true,
        },
        reasonField,
      ]}
    />
  );
}
