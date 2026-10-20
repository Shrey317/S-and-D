import ExcelJS from 'exceljs';
import type { Report } from './repository';
import { cents } from '@/features/checkout/rules';
import { safeCell } from '@/features/reports/rules';
function amount(value: string) {
  const n = cents(value);
  if (n > BigInt(Number.MAX_SAFE_INTEGER))
    throw new Error('Report amount exceeds Excel precision.');
  return Number(n) / 100;
}
export async function reportWorkbook(report: Report) {
  const book = new ExcelJS.Workbook();
  book.creator = 'S & D Fruit and Veg';
  book.created = new Date(report.generatedAt);
  function sheet(
    name: string,
    headers: string[],
    rows: (string | number | boolean)[][],
    money: number[] = [],
  ) {
    const s = book.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
    s.addRow(headers);
    for (const row of rows) s.addRow(row.map((v) => (typeof v === 'string' ? safeCell(v) : v)));
    s.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    s.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF164B36' } };
    s.columns.forEach((column, i) => {
      column.width = i === 0 ? 26 : 22;
    });
    s.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: Math.max(1, s.rowCount), column: headers.length },
    };
    for (const col of money) s.getColumn(col).numFmt = '"R" #,##0.00;[Red]-"R" #,##0.00';
    return s;
  }
  const summary = sheet(
    'Summary',
    ['Measure', 'Value'],
    [
      ['From (SAST)', report.from],
      ['Through (SAST)', report.to],
      ['Generated UTC', report.generatedAt],
      ['Qualifying orders', report.totals.orders],
      ['Gross sales ZAR', amount(report.totals.gross)],
      ['Completed refunds ZAR', amount(report.totals.refunds)],
      ['Net sales ZAR', amount(report.totals.net)],
      [
        'Basis',
        'Paid and fulfilled real orders by order date; refunds as of report time. Test orders excluded.',
      ],
      [
        'Stock and customers',
        'Current records; customer spending uses the selected order-date range.',
      ],
      ['Report', 'S & D Fruit and Veg — sales and operations'],
      ['All real orders in range', report.performance.reduce((sum, r) => sum + r.orders, 0)],
    ],
  );
  summary.getColumn(2).width = 70;
  summary.getColumn(2).alignment = { wrapText: true };
  for (const row of [6, 7, 8]) summary.getCell(row, 2).numFmt = '"R" #,##0.00';
  sheet(
    'Order performance',
    ['Current status', 'Fulfilment', 'Orders'],
    report.performance.map((r) => [r.status, r.method, r.orders]),
  );
  sheet(
    'Daily sales',
    ['Date (SAST)', 'Orders', 'Gross', 'Refunds', 'Net'],
    report.daily.map((r) => [r.date, r.orders, amount(r.gross), amount(r.refunds), amount(r.net)]),
    [3, 4, 5],
  );
  sheet(
    'Monthly sales',
    ['Month (SAST)', 'Orders', 'Gross', 'Refunds', 'Net'],
    report.monthly.map((r) => [
      r.month,
      r.orders,
      amount(r.gross),
      amount(r.refunds),
      amount(r.net),
    ]),
    [3, 4, 5],
  );
  sheet(
    'Bestsellers',
    ['Variant ID', 'Product', 'Packs'],
    report.bestsellers.map((r) => [r.id, r.name, r.quantity]),
  );
  sheet(
    'Orders',
    ['Order ID', 'Date (SAST)', 'Customer ID', 'Name', 'Gross', 'Refunds', 'Net'],
    report.sales.map((r) => [
      r.id,
      r.day,
      r.customerId,
      r.name,
      amount(r.gross),
      amount(r.refunds),
      amount(r.net),
    ]),
    [5, 6, 7],
  );
  sheet(
    'Inventory',
    [
      'SKU',
      'Product',
      'Pack',
      'Status',
      'Active',
      'Price',
      'Physical',
      'Reserved',
      'Available',
      'Alert threshold',
    ],
    report.inventory.map((r) => [
      r.sku,
      r.name,
      r.label,
      r.state,
      r.active,
      amount(r.price),
      r.physical,
      r.reserved,
      r.available,
      r.threshold,
    ]),
    [6],
  );
  sheet(
    'Customers',
    ['Customer ID', 'Name', 'Phone', 'Qualifying orders', 'Net spending'],
    report.customers.map((r) => [r.id, r.name, r.phone, r.orders, amount(r.net)]),
    [5],
  );
  return book.xlsx.writeBuffer();
}
