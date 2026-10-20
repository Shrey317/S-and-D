'use client';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
export function SalesChart({ data }: { data: { date: string; net: string }[] }) {
  return (
    <div
      className="h-72 min-w-0"
      role="img"
      aria-label="Daily net sales chart. Exact figures are in the daily sales table below."
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data.map((d) => ({ date: d.date, net: Number(d.net) }))}>
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: 'var(--foreground)' }}
            minTickGap={40}
          />
          <YAxis tick={{ fontSize: 11, fill: 'var(--foreground)' }} width={65} />
          <Tooltip formatter={(value) => `R${Number(value).toFixed(2)}`} />
          <Bar dataKey="net" name="Net sales" fill="#24734f" isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
