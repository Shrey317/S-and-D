import Link from 'next/link';
import { adminContext } from '@/server/admin/context';
import { AdminScreen, Search, Pager, pagination } from '@/components/admin/ui';
export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { db } = await adminContext(),
    params = await searchParams,
    page = pagination(params.page),
    q = (params.q || '').slice(0, 100),
    rows = await db.customerProfile.findMany({
      where: q
        ? { OR: [{ name: { contains: q, mode: 'insensitive' } }, { phone: { contains: q } }] }
        : {},
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 20,
      skip: (page - 1) * 20,
    });
  return (
    <AdminScreen
      title="Customers"
      description="Profiles and order records only. Passwords, authentication tokens and MFA secrets are never exposed here."
    >
      <Search q={q} placeholder="Search customer name or phone" />
      {rows.map((c) => (
        <article key={c.id} className="rounded-xl border p-5">
          <h2 className="font-semibold">
            <Link className="underline" href={`/admin/customers/${c.id}`}>
              {c.name || 'Customer profile'}
            </Link>
          </h2>
          <p>{c.phone || 'No saved phone'}</p>
          <p className="mt-2 break-all text-sm">{c.id}</p>
        </article>
      ))}
      {!rows.length && <p>No matching customer profiles.</p>}
      <Pager path="/admin/customers" page={page} more={rows.length === 20} q={q} />
    </AdminScreen>
  );
}
