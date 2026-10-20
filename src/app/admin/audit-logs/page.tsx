import { adminContext } from '@/server/admin/context';
import { AdminScreen, Panel, Pager, pagination } from '@/components/admin/ui';
export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { db } = await adminContext(),
    page = pagination((await searchParams).page),
    [rows, payments] = await Promise.all([
      db.adminAudit.findMany({
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 30,
        skip: (page - 1) * 30,
      }),
      db.paymentAudit.findMany({
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 30,
        skip: (page - 1) * 30,
      }),
    ]);
  return (
    <AdminScreen
      title="Audit history"
      description="Append-only records of administrator changes. No runtime action can edit or delete this history."
    >
      <Panel title="Store operations">
        {rows.map((r) => (
          <article key={r.id} className="mb-5 break-words border-b pb-4">
            <h3 className="font-semibold">{r.action.replaceAll('_', ' ')}</h3>
            <p>{r.detail}</p>
            <p className="break-all text-sm">
              {r.createdAt.toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg' })} SAST ·
              Actor {r.actorId} · Record {r.entityId}
            </p>
          </article>
        ))}
        {!rows.length && <p>No store audit entries on this page.</p>}
      </Panel>
      <Panel title="Payment operations">
        {payments.map((r) => (
          <article key={r.id} className="mb-5 break-words border-b pb-4">
            <h3 className="font-semibold">{r.action.replaceAll('_', ' ')}</h3>
            <p>{r.detail}</p>
            <p className="break-all text-sm">
              {r.createdAt.toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg' })} SAST ·
              Actor {r.actorId} · Payment {r.paymentId}
            </p>
          </article>
        ))}
      </Panel>
      <Pager
        path="/admin/audit-logs"
        page={page}
        more={rows.length === 30 || payments.length === 30}
      />
    </AdminScreen>
  );
}
