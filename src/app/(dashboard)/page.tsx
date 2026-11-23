import { Suspense } from "react";
import Link from "next/link";
import { Activity, Flame, Gem, Layers, Rocket, TrendingDown, TrendingUp } from "lucide-react";
import { MARKET_INDICES, fetchMarketIndex, fetchQuotes, fetchStocks, withQuotes } from "@/lib/api";
import { BreadthCard, IndexCard, IndexTrendCard, marketRegime } from "@/components/dashboard/MarketStats";
import { SCREENERS, fundamentalScore, marketBreadth, sectorPerformance } from "@/lib/screener";
import { formatCompact, formatDate, formatPercent } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MarketTicker } from "@/components/dashboard/MarketTicker";
import { AutoRefresh } from "@/components/dashboard/AutoRefresh";
import { ScreenerCard } from "@/components/dashboard/ScreenerCard";
import { DividendCard, ScreenerCardSkeleton } from "@/components/dashboard/DividendCard";
import { cn } from "@/lib/utils";

export const revalidate = 60;

const ICONS: Record<string, React.ReactNode> = {
  gainer: <TrendingUp className="size-4 text-up" />,
  momentum: <Rocket className="size-4 text-primary" />,
  fundamental: <Gem className="size-4 text-sky-500" />,
  accumulation: <Layers className="size-4 text-violet-500" />,
  active: <Flame className="size-4 text-orange-500" />,
  loser: <TrendingDown className="size-4 text-down" />,
};

export default async function MarketOverviewPage() {
  const [stocks, ihsg, lq45, usd] = await Promise.all([
    fetchStocks(),
    ...MARKET_INDICES.map((m) => fetchMarketIndex(m.symbol, m.name).catch(() => null)),
  ]);
  const breadth = marketBreadth(stocks);
  const sectors = sectorPerformance(stocks);
  const topCaps = [...stocks].filter((s) => s.volume > 0).sort((a, b) => b.marketCap - a.marketCap).slice(0, 20);
  // Pasardana = data penutupan sebelumnya; harga ticker ditimpa harga intraday Yahoo.
  const bigCaps = withQuotes(topCaps, await fetchQuotes(topCaps.map((s) => s.symbol)).catch(() => []));
  const capWeighted = sectors.reduce((a, s) => a + s.change * s.marketCap, 0) / (sectors.reduce((a, s) => a + s.marketCap, 0) || 1);

  const byKey = Object.fromEntries(SCREENERS.map((s) => [s.key, s.run(stocks)]));
  const cards = ["gainer", "momentum", "fundamental", "accumulation"] as const;

  return (
    <div className="space-y-6">
      <AutoRefresh />
      <section className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Ringkasan Pasar</h1>
          <p className="text-sm text-muted-foreground">
            Bursa Efek Indonesia · data per {formatDate(breadth.lastDate)}
          </p>
        </div>
      </section>

      <MarketTicker stocks={bigCaps} />

      {/* Statistik pasar: IHSG, LQ45, USD/IDR, breadth, tren IHSG 3 bulan */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
        {ihsg ? (
          <IndexCard index={ihsg} />
        ) : (
          <StatCard label="Kinerja pasar" value={formatPercent(capWeighted)} tone={capWeighted} hint="Tertimbang kapitalisasi (proksi IHSG)" />
        )}
        {lq45 ? (
          <IndexCard index={lq45} />
        ) : (
          <StatCard label="Volume" value={`${formatCompact(breadth.totalVolume / 100)} lot`} hint={`${breadth.total} saham aktif`} />
        )}
        {usd ? (
          <IndexCard index={usd} digits={0} />
        ) : (
          <StatCard label="Nilai transaksi" value={`Rp${formatCompact(breadth.totalValue)}`} hint={`${formatCompact(breadth.totalFrequency)} kali transaksi`} />
        )}
        <BreadthCard breadth={breadth} />
        {ihsg && ihsg.points.length > 20 && (
          <div className="col-span-2 md:col-span-4 xl:col-span-2">
            <IndexTrendCard index={ihsg} regime={marketRegime(ihsg, breadth)} />
          </div>
        )}
      </section>

      {/* Screener ringkas */}
      <section className="space-y-3">
        <div className="flex items-end justify-between">
          <h2 className="text-lg font-semibold">Screener Hari Ini</h2>
          <Link href="/screener" className="text-sm font-medium text-primary hover:underline">
            Buka screener lengkap
          </Link>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {cards.map((key) => {
            const def = SCREENERS.find((s) => s.key === key)!;
            return (
              <ScreenerCard
                key={key}
                title={def.title}
                icon={ICONS[key]}
                description={def.description}
                href={`/screener?tab=${key}`}
                rows={byKey[key].slice(0, 5).map((s) => ({
                  stock: s,
                  metric:
                    key === "fundamental" ? (
                      <span className="rounded-md bg-sky-500/10 px-1.5 py-0.5 text-xs font-semibold text-sky-600 dark:text-sky-400">
                        Skor {fundamentalScore(s)}
                      </span>
                    ) : undefined,
                }))}
              />
            );
          })}
          <Suspense fallback={<ScreenerCardSkeleton />}>
            <DividendCard stocks={stocks} />
          </Suspense>
          <ScreenerCard
            title="Paling Aktif"
            icon={ICONS.active}
            description="Nilai transaksi terbesar hari ini."
            href="/screener?tab=active"
            rows={byKey.active.slice(0, 5).map((s) => ({
              stock: s,
              metric: <span className="text-xs text-muted-foreground tabular-nums">Rp{formatCompact(s.value)}</span>,
            }))}
          />
        </div>
      </section>

      {/* Sektor */}
      <section>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="size-4 text-primary" /> Kinerja Sektor
            </CardTitle>
            <p className="text-xs text-muted-foreground">Perubahan harian tertimbang kapitalisasi pasar.</p>
          </CardHeader>
          <CardContent>
            <SectorBars sectors={sectors} />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function StatCard({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: number }) {
  return (
    <Card className="p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1 text-lg font-bold tabular-nums sm:text-xl",
          tone != null && (tone > 0 ? "text-up" : tone < 0 ? "text-down" : ""),
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </Card>
  );
}

function SectorBars({ sectors }: { sectors: ReturnType<typeof sectorPerformance> }) {
  const max = Math.max(...sectors.map((s) => Math.abs(s.change)), 0.5);
  return (
    <ul className="space-y-2.5">
      {sectors.map((s) => {
        const w = (Math.abs(s.change) / max) * 50;
        return (
          <li key={s.sector} className="grid grid-cols-[minmax(0,9rem)_1fr_4.5rem] items-center gap-3 text-sm sm:grid-cols-[14rem_1fr_5rem]">
            <span className="truncate text-muted-foreground" title={s.sector}>{s.sector}</span>
            <div className="relative h-2.5 rounded-full bg-muted" aria-hidden>
              <div className="absolute inset-y-0 left-1/2 w-px bg-border" />
              <div
                className={cn("absolute inset-y-0 rounded-full", s.change >= 0 ? "left-1/2 bg-up" : "right-1/2 bg-down")}
                style={{ width: `${w}%` }}
              />
            </div>
            <span className={cn("text-right font-medium tabular-nums", s.change >= 0 ? "text-up" : "text-down")}>
              {formatPercent(s.change)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
