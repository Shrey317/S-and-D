import { adminContext } from '@/server/admin/context';
import { AdminScreen, Pager, pagination } from '@/components/admin/ui';
export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { db } = await adminContext(),
    page = pagination((await searchParams).page),
    rows = await db.inventoryAdjustment.findMany({
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 30,
      skip: (page - 1) * 30,
    });
  const variants = await db.productVariant.findMany({
    where: { id: { in: rows.map((r) => r.variantId) } },
    include: { product: true },
  });
  return (
    <AdminScreen
      title="Stock history"
      description="Physical stock changes are append-only. Reservation holds are tracked separately on orders."
    >
      {rows.map((r) => {
        const v = variants.find((v) => v.id === r.variantId);
        return (
          <article key={r.id} className="rounded-xl border p-5">
            <h2 className="font-semibold">
              {v?.product.name} · {v?.label}: {r.before} → {r.after}
            </h2>
            <p className="mt-2">{r.reason}</p>
            <p className="mt-2 break-all text-sm">
              {r.createdAt.toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg' })} SAST ·
              Actor {r.actorId}
              {r.orderId && ` · Order ${r.orderId}`}
            </p>
          </article>
        );
      })}
      {!rows.length && <p>No physical stock changes recorded yet.</p>}
      <Pager path="/admin/inventory/history" page={page} more={rows.length === 30} />
    </AdminScreen>
  );
}
