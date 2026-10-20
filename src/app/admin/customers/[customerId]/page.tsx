import Link from 'next/link';
import { z } from 'zod';
import { notFound } from 'next/navigation';
import { adminContext } from '@/server/admin/context';
import { AdminScreen, Panel, reasonField, Pager, pagination } from '@/components/admin/ui';
import { ActionForm } from '@/components/account/action-form';
import { approvalAction } from '@/server/admin/actions';
import { formatRand } from '@/features/catalog/money';
export default async function CustomerPage({
  params,
  searchParams,
}: {
  params: Promise<{ customerId: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { db } = await adminContext(),
    { customerId } = await params,
    page = pagination((await searchParams).page);
  if (!z.uuid().safeParse(customerId).success) notFound();
  const [profile, orders, approvals] = await Promise.all([
    db.customerProfile.findUnique({ where: { id: customerId }, include: { addresses: true } }),
    db.order.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      skip: (page - 1) * 20,
    }),
    db.deliveryApproval.findMany({ where: { customerId } }),
  ]);
  if (!profile && !orders.length) notFound();
  const [spend] = await db.$queryRaw<
    { total: string }[]
  >`SELECT COALESCE(sum(o.total-p.refunded),0)::text AS total FROM commerce."Order" o JOIN commerce."Payment" p ON p."orderId"=o.id WHERE o."customerId"=${customerId}::uuid AND o.status IN ('DELIVERED','COLLECTED') AND o."paymentStatus" IN ('PAID','PARTIALLY_REFUNDED') AND o.snapshot->>'isTest'='false' AND p.exception IS NULL AND p.received=o.total AND p.refunded<o.total`;
  return (
    <AdminScreen
      title={profile?.name || 'Customer record'}
      description="Delivery approval applies only to this exact saved address and the current delivery rules. Check the owner-approved service boundary before approving."
    >
      <p>{profile?.phone}</p>
      <p>Qualifying net spending (excludes test orders): {formatRand(spend?.total || '0.00')}</p>
      <div className="grid items-start gap-6 lg:grid-cols-2">
        {profile?.addresses.map((a) => (
          <Panel key={a.id} title={a.label}>
            <p className="mb-3">
              {a.recipient} · {a.street}, {a.suburb}, {a.city}, {a.postalCode}
            </p>
            <p className="mb-4">{a.instructions}</p>
            <p className="mb-4">
              {approvals.some((p) => p.addressId === a.id)
                ? 'Approval recorded; checkout rechecks changes and expiry.'
                : 'No delivery approval.'}
            </p>
            <ActionForm
              action={approvalAction}
              hidden={{ addressId: a.id }}
              label="Save delivery approval"
              fields={[
                {
                  name: 'approved',
                  label: 'I verified this exact address against the approved service area',
                  type: 'checkbox',
                },
                {
                  name: 'expiresAt',
                  label: 'Approval expiry (Johannesburg time)',
                  type: 'datetime-local',
                },
                reasonField,
              ]}
            />
          </Panel>
        ))}
      </div>
      <Panel title="Order history">
        {orders.map((o) => (
          <p key={o.id} className="mb-4 break-all">
            <Link className="underline" href={`/admin/orders/${o.id}`}>
              {o.id}
            </Link>{' '}
            · {o.status} · {formatRand(o.total.toFixed(2))}
          </p>
        ))}
        {!orders.length && <p>No orders.</p>}
      </Panel>
      <Pager path={`/admin/customers/${customerId}`} page={page} more={orders.length === 20} />
    </AdminScreen>
  );
}
