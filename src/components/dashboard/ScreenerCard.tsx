import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Stock } from "@/lib/types";
import { formatPrice } from "@/lib/format";
import { ChangePill } from "./ChangeText";

export interface ScreenerRow {
  stock: Stock;
  /** Teks metrik tambahan di bawah harga, mis. "Yield 6,8%" */
  metric?: React.ReactNode;
}

export function ScreenerCard({
  title,
  icon,
  description,
  rows,
  href,
  emptyText = "Belum ada saham yang memenuhi kriteria hari ini.",
}: {
  title: string;
  icon?: React.ReactNode;
  description?: string;
  rows: ScreenerRow[];
  href?: string;
  emptyText?: string;
}) {
  return (
    <Card className="flex flex-col">
      <CardHeader className="flex-row items-start justify-between gap-2">
        <div className="min-w-0">
          <CardTitle className="flex items-center gap-2 text-base">
            {icon}
            {title}
          </CardTitle>
          {description && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{description}</p>}
        </div>
        {href && (
          <Link href={href} className="flex shrink-0 items-center text-xs font-medium text-primary hover:underline">
            Semua <ChevronRight className="size-3.5" />
          </Link>
        )}
      </CardHeader>
      <CardContent className="flex-1 space-y-0.5">
        {rows.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">{emptyText}</p>}
        {rows.slice(0, 5).map(({ stock: s, metric }, i) => (
          <Link
            key={s.symbol}
            href={`/stock/${s.symbol}`}
            className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-accent"
          >
            <span className="w-4 text-xs text-muted-foreground tabular-nums">{i + 1}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">{s.symbol}</span>
              <span className="block truncate text-xs text-muted-foreground">{s.name}</span>
            </span>
            <span className="flex flex-col items-end gap-0.5">
              <span className="text-sm font-medium tabular-nums">{formatPrice(s.price)}</span>
              {metric ?? <ChangePill value={s.change} />}
            </span>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
