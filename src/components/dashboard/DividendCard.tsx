import { Coins } from "lucide-react";
import { fetchTopDividends } from "@/lib/dividends";
import { formatNumber } from "@/lib/format";
import type { Stock } from "@/lib/types";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/misc";
import { ScreenerCard } from "./ScreenerCard";

/** Server component async — dibungkus Suspense agar tidak memblokir halaman. */
export async function DividendCard({ stocks }: { stocks: Stock[] }) {
  const picks = await fetchTopDividends(stocks);
  return (
    <ScreenerCard
      title="Top Dividen"
      icon={<Coins className="size-4 text-warn" />}
      description="Dividend yield tertinggi dari 40 saham berkapitalisasi terbesar."
      href="/screener?tab=dividend"
      rows={picks.map((p) => ({
        stock: p.stock,
        metric: (
          <span className="rounded-md bg-warn-soft px-1.5 py-0.5 text-xs font-semibold text-warn tabular-nums">
            Yield {formatNumber(p.dividendYield, 1)}%
          </span>
        ),
      }))}
      emptyText="Data dividen sedang tidak tersedia."
    />
  );
}

export function ScreenerCardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-3 w-48" />
      </CardHeader>
      <CardContent className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-8 flex-1" />
            <Skeleton className="h-8 w-16" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
