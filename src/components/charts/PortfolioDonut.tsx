"use client";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { formatRupiah } from "@/lib/format";

export interface Slice {
  name: string;
  value: number;
}

export const SLICE_COLORS = [
  "#16a34a", "#3b82f6", "#f59e0b", "#8b5cf6", "#ef4444",
  "#06b6d4", "#ec4899", "#84cc16", "#f97316", "#64748b",
];

export function PortfolioDonut({ data }: { data: Slice[] }) {
  const total = data.reduce((a, s) => a + s.value, 0);
  return (
    // Container query: tata letak mengikuti lebar kartu, bukan lebar layar
    <div className="@container">
    <div className="flex flex-col items-center gap-5 @md:flex-row">
      <div className="relative size-44 shrink-0 @md:size-48">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="100%" paddingAngle={data.length > 1 ? 2 : 0} stroke="none">
              {data.map((_, i) => (
                <Cell key={i} fill={SLICE_COLORS[i % SLICE_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(v) => formatRupiah(Number(v), true)}
              contentStyle={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontSize: 12,
                color: "var(--foreground)",
              }}
              itemStyle={{ color: "var(--foreground)" }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="text-[11px] text-muted-foreground">Total</p>
            <p className="text-sm font-bold tabular-nums">{formatRupiah(total, true)}</p>
          </div>
        </div>
      </div>
      <ul className="w-full min-w-0 space-y-2 text-sm @md:flex-1">
        {data.map((s, i) => (
          <li key={s.name} className="flex min-w-0 items-center gap-2">
            <span className="size-2.5 shrink-0 rounded-full" style={{ background: SLICE_COLORS[i % SLICE_COLORS.length] }} />
            <span className="min-w-0 flex-1 truncate" title={s.name}>{s.name}</span>
            <span className="shrink-0 font-medium tabular-nums">
              {total ? ((s.value / total) * 100).toLocaleString("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : "0"}%
            </span>
          </li>
        ))}
      </ul>
    </div>
    </div>
  );
}
