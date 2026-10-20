import Link from 'next/link';
import { adminContext } from '@/server/admin/context';
import { AdminScreen, Panel } from '@/components/admin/ui';
import { readReports } from '@/server/reports/repository';
import { formatRand } from '@/features/catalog/money';
import { SalesChart } from '@/components/admin/sales-chart';
export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { db } = await adminContext();
  let report: Awaited<ReturnType<typeof readReports>>;
  try {
    report = await readReports(db, await searchParams);
  } catch {
    return (
      <AdminScreen title="Reports">
        <p>
          Choose valid dates spanning at most 366 days. Reports are limited to 5,000 source records.
        </p>
        <Link className="underline" href="/admin/reports">
          Reset dates
        </Link>
      </AdminScreen>
    );
  }
  return (
    <AdminScreen
      title="Reports"
      description="Paid and fulfilled real orders by order date in Johannesburg time. Completed refunds are deducted as of now, including full refunds. Test, unpaid, cancelled and payment-exception orders are excluded."
    >
      <form className="flex flex-wrap items-end gap-4">
        <label>
          From
          <input
            className="ml-3 min-h-12 rounded border bg-card px-3"
            type="date"
            name="from"
            defaultValue={report.from}
            required
          />
        </label>
        <label>
          Through
          <input
            className="ml-3 min-h-12 rounded border bg-card px-3"
            type="date"
            name="to"
            defaultValue={report.to}
            required
          />
        </label>
        <button className="min-h-12 rounded border px-5">Update report</button>
      </form>
      <Link
        className="underline"
        href={`/admin/reports/export?${new URLSearchParams({ from: report.from, to: report.to })}`}
      >
        Download Excel workbook
      </Link>
      <p className="text-sm">
        Exports contain customer information. Store them securely and share only with authorized
        people.
      </p>
      <div className="grid gap-4 sm:grid-cols-3">
        <Panel title="Gross sales">
          <p>{formatRand(report.totals.gross)}</p>
        </Panel>
        <Panel title="Completed refunds">
          <p>{formatRand(report.totals.refunds)}</p>
        </Panel>
        <Panel title="Net sales">
          <p>
            {formatRand(report.totals.net)} · {report.totals.orders} orders
          </p>
        </Panel>
      </div>
      <Panel title="Daily net sales">
        <SalesChart data={report.daily} />
      </Panel>
      <Panel title="Daily figures">
        <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Daily sales table">
          <table className="w-full text-left">
            <caption className="sr-only">Daily sales in South African rand</caption>
            <thead>
              <tr>
                {['Date', 'Orders', 'Gross', 'Refunds', 'Net'].map((h) => (
                  <th className="p-2" key={h} scope="col">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {report.daily.map((d) => (
                <tr key={d.date}>
                  {[
                    d.date,
                    d.orders,
                    formatRand(d.gross),
                    formatRand(d.refunds),
                    formatRand(d.net),
                  ].map((v, i) => (
                    <td className="p-2" key={i}>
                      {v}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <Panel title="Monthly sales">
        {report.monthly.map((m) => (
          <p className="mb-3" key={m.month}>
            {m.month}: gross {formatRand(m.gross)}, refunds {formatRand(m.refunds)}, net{' '}
            {formatRand(m.net)} · {m.orders} orders
          </p>
        ))}
      </Panel>
      <Panel title="Bestselling products">
        <p className="mb-4 text-sm">
          Packs from qualifying orders with positive net sales. Partial monetary refunds do not
          specify returned units.
        </p>
        {report.bestsellers.slice(0, 20).map((b) => (
          <p key={b.id}>
            {b.name} · {b.quantity} packs
          </p>
        ))}
        {!report.bestsellers.length && <p>No qualifying real sales in this range.</p>}
      </Panel>
      <Panel title="Inventory and customers">
        <p>
          {report.inventory.length} current variants ·{' '}
          {
            report.inventory.filter(
              (v) => v.available <= v.threshold && v.active && v.state === 'ACTIVE',
            ).length
          }{' '}
          active variants at/below their stock threshold.
        </p>
        <p>
          {report.customers.length} customer records. The workbook includes current inventory,
          customer details and spending within the selected range.
        </p>
        <Link className="mt-4 inline-block underline" href="/admin/inventory">
          Review inventory
        </Link>
      </Panel>
      <Panel title="Order performance">
        <p className="mb-4 text-sm">
          Current fulfilment states of all real orders created in this date range, including unpaid,
          cancelled and expired orders. These counts do not represent sales.
        </p>
        {report.performance.map((r) => (
          <p key={`${r.status}-${r.method}`}>
            {r.status.replaceAll('_', ' ')} ·{' '}
            {r.method === 'COLLECTION' ? 'Collection' : 'Delivery'}: {r.orders}
          </p>
        ))}
        {!report.performance.length && <p>No real orders in this range.</p>}
      </Panel>
    </AdminScreen>
  );
}
