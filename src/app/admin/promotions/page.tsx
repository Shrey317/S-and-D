import Link from 'next/link';
import { adminContext } from '@/server/admin/context';
import { AdminScreen, Search, Pager, pagination } from '@/components/admin/ui';
export default async function PromotionsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { db } = await adminContext(),
    params = await searchParams,
    page = pagination(params.page),
    q = (params.q || '').slice(0, 100),
    rows = await db.promotion.findMany({
      where: q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { code: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {},
      orderBy: { id: 'asc' },
      take: 20,
      skip: (page - 1) * 20,
    });
  return (
    <AdminScreen
      title="Promotions"
      description="One offer per order: a supplied code, or the best eligible automatic offer. Discounts never exceed qualifying items. Cancelled and expired orders release redemption capacity; completed orders retain their historical discount."
    >
      <Link className="underline" href="/admin/promotions/new">
        New promotion
      </Link>
      <Search q={q} placeholder="Search promotion name or code" />
      {rows.map((p) => (
        <article key={p.id} className="rounded-xl border p-5">
          <h2 className="font-semibold">
            <Link className="underline" href={`/admin/promotions/${p.id}`}>
              {p.name}
            </Link>
          </h2>
          <p className="mt-2">
            {p.kind} · {p.value.toFixed(2)} · {p.code || 'Automatic'} ·{' '}
            {p.active ? 'Active within dates' : 'Inactive'}
          </p>
        </article>
      ))}
      {!rows.length && <p>No promotions yet.</p>}
      <Pager path="/admin/promotions" page={page} more={rows.length === 20} q={q} />
    </AdminScreen>
  );
}
