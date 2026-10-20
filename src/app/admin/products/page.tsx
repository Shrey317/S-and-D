import Link from 'next/link';
import { adminContext } from '@/server/admin/context';
import { AdminScreen, Search, Pager, pagination } from '@/components/admin/ui';
export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; state?: string }>;
}) {
  const { db } = await adminContext(),
    params = await searchParams,
    q = (params.q || '').slice(0, 100),
    page = pagination(params.page);
  const rows = await db.product.findMany({
    where: {
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { variants: { some: { sku: { contains: q, mode: 'insensitive' } } } },
            ],
          }
        : {}),
      ...(['DRAFT', 'ACTIVE', 'ARCHIVED'].includes(params.state || '')
        ? { state: params.state as 'DRAFT' | 'ACTIVE' | 'ARCHIVED' }
        : {}),
    },
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
    take: 20,
    skip: (page - 1) * 20,
    include: { category: true, _count: { select: { variants: true } } },
  });
  return (
    <AdminScreen
      title="Products"
      description="Archive products to remove them from sale while preserving order history. Each selling pack has its own SKU and stock balance."
    >
      <Link className="underline" href="/admin/products/new">
        New product
      </Link>
      <Search q={q} placeholder="Search product name or SKU" />
      <div className="flex gap-4">
        {['ACTIVE', 'DRAFT', 'ARCHIVED'].map((state) => (
          <Link key={state} className="underline" href={`/admin/products?state=${state}`}>
            {state.toLowerCase()}
          </Link>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {rows.map((p) => (
          <article key={p.id} className="rounded-xl border p-5">
            <h2 className="text-xl font-semibold">
              <Link href={`/admin/products/${p.id}`} className="underline">
                {p.name}
              </Link>
            </h2>
            <p className="mt-2">
              {p.category.name} · {p.state} · {p._count.variants} variants
            </p>
            <p>
              {p.isSample ? 'Development sample' : 'Retail catalog'}
              {p.featured ? ' · Featured' : ''}
            </p>
          </article>
        ))}
      </div>
      {!rows.length && <p>No matching products.</p>}
      <Pager
        path="/admin/products"
        page={page}
        more={rows.length === 20}
        q={q}
        filters={{ state: params.state || '' }}
      />
    </AdminScreen>
  );
}
