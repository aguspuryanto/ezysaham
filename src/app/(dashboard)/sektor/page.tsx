import type { Metadata } from "next";
import Link from "next/link";
import { Activity, ArrowLeft } from "lucide-react";
import { fetchStocks } from "@/lib/api";
import { marketBreadth, sectorHref, sectorPerformance } from "@/lib/screener";
import { toRow } from "@/lib/rows";
import { formatCompact, formatDate, formatPercent } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StockTable } from "@/components/dashboard/StockTable";
import { SectorBars } from "@/components/dashboard/SectorBars";
import { TermTooltip } from "@/components/ui/TermTooltip";
import { cn } from "@/lib/utils";

export const revalidate = 300;

type Props = { searchParams: Promise<{ sector?: string | string[] }> };

async function readSector(searchParams: Props["searchParams"]) {
  const { sector } = await searchParams;
  return (Array.isArray(sector) ? sector[0] : sector)?.trim() || null;
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const sector = await readSector(searchParams);
  return sector
    ? { title: `Saham Sektor ${sector}`, description: `Daftar saham BEI sektor ${sector} beserta kinerja harian, valuasi, dan nilai transaksi.` }
    : { title: "Sektor Saham", description: "Kinerja harian seluruh sektor saham BEI dan daftar saham per sektor." };
}

export default async function SectorPage({ searchParams }: Props) {
  const requested = await readSector(searchParams);
  const stocks = await fetchStocks();
  const sectors = sectorPerformance(stocks);
  const perf = requested ? sectors.find((s) => s.sector.toLowerCase() === requested.toLowerCase()) : undefined;

  if (!perf) {
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Sektor Saham</h1>
          <p className="text-sm text-muted-foreground">
            Pilih sektor untuk melihat daftar sahamnya. Data per {formatDate(marketBreadth(stocks).lastDate)}.
          </p>
        </div>
        {requested && (
          <p role="status" className="rounded-xl border border-warn/40 bg-warn-soft px-4 py-3 text-sm">
            Sektor “{requested}” tidak ditemukan. Pilih salah satu sektor di bawah.
          </p>
        )}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="size-4 text-primary" /> Kinerja Sektor Hari Ini
            </CardTitle>
            <p className="text-xs text-muted-foreground">Perubahan harian tertimbang kapitalisasi pasar.</p>
          </CardHeader>
          <CardContent>
            <SectorBars sectors={sectors} />
          </CardContent>
        </Card>
      </div>
    );
  }

  const list = stocks.filter((s) => s.sector === perf.sector && s.volume > 0);
  const breadth = marketBreadth(list);
  const rank = sectors.indexOf(perf) + 1;

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <Link href="/sektor" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Semua sektor
        </Link>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Sektor {perf.sector}</h1>
        <p className="text-sm text-muted-foreground">
          {list.length} saham aktif · peringkat {rank} dari {sectors.length} sektor hari ini · data per {formatDate(breadth.lastDate)}
        </p>
      </div>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Perubahan hari ini"
          value={formatPercent(perf.change)}
          tone={perf.change}
          hint="Tertimbang kapitalisasi"
        />
        <Stat
          label="Naik / turun"
          value={
            <>
              <span className="text-up">{breadth.up}</span>
              <span className="text-muted-foreground"> / </span>
              <span className="text-down">{breadth.down}</span>
            </>
          }
          hint={`${breadth.flat} saham tetap`}
        />
        <Stat label={<TermTooltip term="kapitalisasi">Kapitalisasi</TermTooltip>} value={`Rp${formatCompact(perf.marketCap)}`} />
        <Stat
          label={<TermTooltip term="nilai-transaksi">Nilai transaksi</TermTooltip>}
          value={`Rp${formatCompact(breadth.totalValue)}`}
          hint={`${formatCompact(breadth.totalFrequency)} kali transaksi`}
        />
      </section>

      <StockTable key={perf.sector} rows={list.map((s) => toRow(s))} />

      <nav aria-label="Sektor lain" className="space-y-2 border-t pt-4">
        <p className="text-sm font-medium">Sektor lain</p>
        <div className="flex flex-wrap gap-2">
          {sectors
            .filter((s) => s.sector !== perf.sector)
            .map((s) => (
              <Link
                key={s.sector}
                href={sectorHref(s.sector)}
                className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-sm hover:border-primary/50"
              >
                {s.sector}
                <span className={cn("text-xs font-medium tabular-nums", s.change >= 0 ? "text-up" : "text-down")}>
                  {formatPercent(s.change)}
                </span>
              </Link>
            ))}
        </div>
      </nav>
    </div>
  );
}

function Stat({ label, value, hint, tone }: { label: React.ReactNode; value: React.ReactNode; hint?: string; tone?: number }) {
  return (
    <Card className="p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-lg font-bold tabular-nums sm:text-xl", tone != null && (tone > 0 ? "text-up" : tone < 0 ? "text-down" : ""))}>
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </Card>
  );
}
