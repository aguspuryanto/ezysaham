import type { Metadata } from "next";
import Link from "next/link";
import { Info } from "lucide-react";
import { fetchStocks } from "@/lib/api";
import { fetchTopDividends } from "@/lib/dividends";
import { SCREENERS, fundamentalScore } from "@/lib/screener";
import { toRow } from "@/lib/rows";
import { StockTable } from "@/components/dashboard/StockTable";
import { DividendFormat, ScoreFormat } from "./formats";
import { cn } from "@/lib/utils";
import { TermTooltip } from "@/components/ui/TermTooltip";
import type { TermId } from "@/lib/glossary";

export const metadata: Metadata = { title: "Screener Saham" };
export const revalidate = 300;

const TABS = [
  { key: "all", label: "Semua" },
  { key: "gainer", label: "Top Gainer" },
  { key: "momentum", label: "Momentum" },
  { key: "dividend", label: "Dividen" },
  { key: "fundamental", label: "Fundamental" },
  { key: "accumulation", label: "Akumulasi" },
  { key: "active", label: "Teraktif" },
  { key: "loser", label: "Top Loser" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

/** Istilah yang perlu dipahami untuk membaca tiap tab. */
const TAB_TERMS: Record<TabKey, TermId[]> = {
  all: ["per", "roe", "kapitalisasi", "nilai-transaksi"],
  gainer: ["ara-arb", "fomo", "nilai-transaksi"],
  momentum: ["momentum", "fomo", "saham-gorengan", "nilai-transaksi"],
  dividend: ["dividend-yield", "payout-ratio", "cum-date", "dividend-trap"],
  fundamental: ["skor-fundamental", "per", "roe", "pbv", "value-trap"],
  accumulation: ["akumulasi", "nilai-transaksi", "saham-gorengan"],
  active: ["nilai-transaksi", "volume"],
  loser: ["value-trap", "ara-arb"],
};

export default async function ScreenerPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab: rawTab } = await searchParams;
  const tab: TabKey = TABS.some((t) => t.key === rawTab) ? (rawTab as TabKey) : "all";
  const stocks = await fetchStocks();

  let title = "Semua Saham";
  let description = "Seluruh saham BEI yang aktif diperdagangkan. Gunakan filter dan urutan untuk menyaring sendiri.";
  let ranked = false;
  let extra: "dividend" | "score" | undefined;
  let rows;

  if (tab === "all") {
    rows = stocks.filter((s) => s.volume > 0).map((s) => toRow(s));
  } else if (tab === "dividend") {
    const picks = await fetchTopDividends(stocks);
    title = "Top Dividen";
    description =
      "Dividend yield (12 bulan terakhir) tertinggi dari 40 saham berkapitalisasi terbesar. Yield tinggi belum tentu berulang — cek konsistensi riwayat dividennya.";
    ranked = true;
    extra = "dividend";
    rows = picks.map((p) => toRow(p.stock, Math.round(p.dividendYield * 100) / 100));
  } else {
    const def = SCREENERS.find((s) => s.key === tab)!;
    title = def.title;
    description = def.description;
    ranked = true;
    const result = def.run(stocks).slice(0, 100);
    if (tab === "fundamental") {
      extra = "score";
      rows = result.map((s) => toRow(s, fundamentalScore(s)));
    } else {
      rows = result.map((s) => toRow(s));
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Screener Saham</h1>
        <p className="text-sm text-muted-foreground">Saring saham berdasarkan momentum, fundamental, dividen, dan akumulasi.</p>
      </div>

      <nav aria-label="Kategori screener" className="-mx-4 overflow-x-auto px-4 scrollbar-none sm:mx-0 sm:px-0">
        <div className="flex w-max gap-2">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={t.key === "all" ? "/screener" : `/screener?tab=${t.key}`}
              scroll={false}
              aria-current={tab === t.key ? "page" : undefined}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-sm font-medium whitespace-nowrap transition-colors",
                tab === t.key ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </Link>
          ))}
        </div>
      </nav>

      {/* <div className="flex gap-3 rounded-xl border bg-card p-4">
        <Info className="mt-0.5 size-4 shrink-0 text-primary" />
        <div>
          <h2 className="font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>Istilah terkait:</span>
            {TAB_TERMS[tab].map((id) => (
              <TermTooltip key={id} term={id} className="font-medium text-foreground" />
            ))}
            <Link href="/glosarium" className="font-medium text-primary hover:underline">Semua istilah</Link>
          </p>
        </div>
      </div> */}

      {extra === "dividend" ? (
        <DividendFormat rows={rows} />
      ) : extra === "score" ? (
        <ScoreFormat rows={rows} />
      ) : (
        <StockTable key={tab} rows={rows} ranked={ranked} />
      )}
    </div>
  );
}
