import { z } from 'zod';
export function reportRange(
  raw: { from?: string | undefined; to?: string | undefined },
  now = new Date(),
) {
  const today = new Date(now.getTime() + 7200000).toISOString().slice(0, 10);
  const from = raw.from || `${today.slice(0, 7)}-01`,
    to = raw.to || today;
  for (const day of [from, to])
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(day) ||
      !Number.isFinite(Date.parse(day)) ||
      new Date(day).toISOString().slice(0, 10) !== day
    )
      throw new Error('Choose valid dates.');
  const days = (Date.parse(to) - Date.parse(from)) / 86400000;
  if (days < 0 || days > 365) throw new Error('Choose an inclusive range of up to 366 days.');
  return {
    from,
    to,
    start: new Date(`${from}T00:00:00+02:00`),
    end: new Date(new Date(`${to}T00:00:00+02:00`).getTime() + 86400000),
  };
}
export const reportQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
});
export function safeCell(value: string) {
  return /^[\s]*[=+@-]/.test(value) || /^[\t\r\n]/.test(value) ? `'${value}` : value;
}
