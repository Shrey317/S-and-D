import { adminContext } from '@/server/admin/context';
import { withAdmin, audit } from '@/server/admin/repository';
import { readReports } from '@/server/reports/repository';
import { reportWorkbook } from '@/server/reports/workbook';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const { db, actor } = await adminContext();
  const params = new URL(request.url).searchParams;
  try {
    const report = await readReports(db, {
      from: params.get('from') || undefined,
      to: params.get('to') || undefined,
    });
    const buffer = await reportWorkbook(report);
    await withAdmin(db, actor, (tx) =>
      audit(
        tx,
        actor,
        'EXPORT_REPORT',
        'reports',
        `${report.from} through ${report.to}; ${report.totals.orders} qualifying orders; customer and inventory data included.`,
      ),
    );
    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="sd-reports-${report.from}-${report.to}.xlsx"`,
        'Cache-Control': 'no-store, max-age=0, private',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return new Response(
      'Unable to export. Check dates and report size; try again if the service is unavailable.',
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
