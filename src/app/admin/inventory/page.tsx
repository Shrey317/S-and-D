import { randomUUID } from 'node:crypto';
import Link from 'next/link';
import { adminContext } from '@/server/admin/context';
import { AdminScreen, Panel, Search, Pager, pagination, reasonField } from '@/components/admin/ui';
import { ActionForm } from '@/components/account/action-form';
import { stockAction } from '@/server/admin/actions';
export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { db } = await adminContext(),
    params = await searchParams,
    page = pagination(params.page),
    q = (params.q || '').slice(0, 100);
  const rows = await db.productVariant.findMany({
    where: q
      ? {
          OR: [
            { sku: { contains: q, mode: 'insensitive' } },
            { product: { name: { contains: q, mode: 'insensitive' } } },
          ],
        }
      : {},
    include: { product: true, inventory: true },
    orderBy: [{ product: { name: 'asc' } }, { id: 'asc' }],
    take: 20,
    skip: (page - 1) * 20,
  });
  return (
    <AdminScreen
      title="Inventory"
      description="Enter the physically counted packs. Reserved packs cannot be removed; resolve the affected orders first. Every correction needs a reason and preserves history."
    >
      <Link className="underline" href="/admin/inventory/history">
        Stock history
      </Link>
      <Search q={q} placeholder="Search product name or SKU" />
      <div className="grid items-start gap-6 lg:grid-cols-2">
        {rows.map((v) => (
          <Panel key={v.id} title={`${v.product.name} · ${v.label}`}>
            <p className="mb-4">
              SKU {v.sku} · Physical {v.inventory?.onHand || 0} · Reserved{' '}
              {v.inventory?.reserved || 0} · Available{' '}
              {(v.inventory?.onHand || 0) - (v.inventory?.reserved || 0)}
            </p>
            {(v.inventory?.onHand || 0) - (v.inventory?.reserved || 0) <= v.lowStockThreshold && (
              <p className="mb-4 font-semibold">Low stock — threshold {v.lowStockThreshold}</p>
            )}
            <ActionForm
              action={stockAction}
              hidden={{
                variantId: v.id,
                key: randomUUID(),
                version: String(v.inventory?.version || 0),
              }}
              label="Record stock correction"
              fields={[
                {
                  name: 'onHand',
                  label: 'Counted physical packs',
                  type: 'number',
                  value: String(v.inventory?.onHand || 0),
                  required: true,
                },
                reasonField,
              ]}
            />
          </Panel>
        ))}
      </div>
      <Pager path="/admin/inventory" page={page} more={rows.length === 20} q={q} />
    </AdminScreen>
  );
}
