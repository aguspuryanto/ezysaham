import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Coins, Gauge, Lightbulb, LineChart } from "lucide-react";
import { fetchFundamentals, fetchHistory, fetchQuotes, fetchStock, fetchStocks, withQuotes } from "@/lib/api";
import { summarizeTechnicals, type Signal } from "@/lib/indicators";
import { fundamentalScore } from "@/lib/screener";
import { fairValues } from "@/lib/valuation";
import { entrySignal } from "@/lib/entrySignal";
import { EntrySignalCard } from "@/components/stock/EntrySignalCard";
import { formatCompact, formatDate, formatNumber, formatPercent, formatPrice, formatRupiah } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/misc";
import { ChangeText } from "@/components/dashboard/ChangeText";
import { StockChartPanel } from "@/components/charts/StockChartPanel";
import { AddToPortfolioButton } from "@/components/portfolio/AddToPortfolioButton";
import { WatchlistButton } from "@/components/watchlist/WatchlistButton";
import { AutoRefresh } from "@/components/dashboard/AutoRefresh";
import { cn } from "@/lib/utils";

// 60 detik agar harga intraday (Yahoo) ikut segar saat AutoRefresh berjalan.
export const revalidate = 60;

type Props = { params: Promise<{ symbol: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { symbol } = await params;
  const s = await fetchStock(symbol);
  return { title: s ? `${s.symbol} — ${s.name}` : symbol.toUpperCase() };
}

export default async function StockDetailPage({ params }: Props) {
  const { symbol: raw } = await params;
  const symbol = raw.toUpperCase();
  if (!/^[A-Z0-9]{2,8}$/.test(symbol)) notFound();

  const [all, history, fundamentals, quotes] = await Promise.all([
    fetchStocks(),
    fetchHistory(symbol, "1y"),
    fetchFundamentals(symbol),
    fetchQuotes([symbol]).catch(() => []),
  ]);
  const closing = all.find((s) => s.symbol === symbol);
  if (!closing) notFound();
  // Pasardana hanya berisi harga penutupan hari bursa sebelumnya; timpa harga dengan
  // harga intraday Yahoo (tertunda ±10 menit) bila tersedia. Data lain tetap dari Pasardana.
  const [stock] = withQuotes([closing], quotes);
  const isLive = quotes.length > 0;

  const tech = summarizeTechnicals(history);
  const score = fundamentalScore(stock);
  const valuation = fairValues(stock, all);
  const signal = entrySignal(stock, fundamentals, valuation.median, tech);
  const range52 =
    stock.high52 && stock.low52 && stock.high52 > stock.low52
      ? ((stock.price - stock.low52) / (stock.high52 - stock.low52)) * 100
      : null;

  return (
    <div className="space-y-5">
      <AutoRefresh />
      <Link href="/screener" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Kembali ke screener
      </Link>

      {/* Header */}
      <section className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{stock.symbol}</h1>
            <Badge variant="outline">{stock.sector}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">{stock.name}</p>
          <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-3xl font-bold tabular-nums">{formatPrice(stock.price)}</span>
            <span className={cn("text-base font-semibold tabular-nums", stock.changeValue > 0 ? "text-up" : stock.changeValue < 0 ? "text-down" : "text-muted-foreground")}>
              {stock.changeValue > 0 ? "+" : ""}
              {formatPrice(stock.changeValue)} ({formatPercent(stock.change)})
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {isLive ? "Harga intraday (tertunda ±10 menit) · " : ""}Data per {formatDate(stock.lastDate)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <WatchlistButton symbol={stock.symbol} />
          <AddToPortfolioButton symbol={stock.symbol} price={stock.price} />
        </div>
      </section>

      {/* Statistik harian */}
      <section className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-4 lg:grid-cols-8">
        {[
          ["Open", formatPrice(stock.open)],
          ["High", formatPrice(stock.high)],
          ["Low", formatPrice(stock.low)],
          ["Prev", formatPrice(stock.prevClose)],
          ["Volume", `${formatCompact(stock.volume / 100)} lot`],
          ["Nilai", formatRupiah(stock.value, true)],
          ["Frekuensi", formatCompact(stock.frequency)],
          ["Kap. Pasar", formatRupiah(stock.marketCap, true)],
        ].map(([k, v]) => (
          <div key={k} className="bg-card px-3 py-2.5">
            <p className="text-xs text-muted-foreground">{k}</p>
            <p className="text-sm font-semibold tabular-nums">{v}</p>
          </div>
        ))}
      </section>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Kolom kiri: chart + fundamental. Kolom kanan: sinyal, teknikal, kinerja, dividen.
            Ditumpuk per kolom agar tinggi kolom kanan tidak membuat celah di bawah chart. */}
        <div className="min-w-0 space-y-5 lg:col-span-2">
          {/* Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <LineChart className="size-4 text-primary" /> Chart Harga
              </CardTitle>
            </CardHeader>
            <CardContent>
              <StockChartPanel symbol={stock.symbol} initialData={history} initialRange="1y" />
            </CardContent>
          </Card>

          {/* Fundamental */}
          <Card>
            <CardHeader className="flex-row items-start justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Gauge className="size-4 text-sky-500" /> Fundamental
                </CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">Rasio valuasi & kinerja keuangan. Warna adalah patokan umum untuk pemula.</p>
              </div>
              {score != null && (
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Skor</p>
                  <p className="text-2xl font-bold text-sky-600 tabular-nums dark:text-sky-400">{score}</p>
                </div>
              )}
            </CardHeader>
            <CardContent>
              <div className="grid gap-x-6 sm:grid-cols-2">
                <Ratio label="PER" hint="Harga / laba per saham. Makin kecil makin murah." value={stock.peRatio} fmt={(v) => `${formatNumber(v, 1)}x`} rate={(v) => (v <= 0 ? "bad" : v < 15 ? "good" : v < 25 ? "ok" : "bad")} />
                <Ratio label="PBV" hint="Harga / nilai buku. <1 berarti di bawah nilai buku." value={stock.pbv} fmt={(v) => `${formatNumber(v, 2)}x`} rate={(v) => (v <= 0 ? "bad" : v < 1.5 ? "good" : v < 3 ? "ok" : "bad")} />
                <Ratio label="ROE" hint="Laba bersih / ekuitas. Efisiensi perusahaan memakai modal." value={stock.roe} fmt={(v) => `${formatNumber(v, 1)}%`} rate={(v) => (v >= 15 ? "good" : v >= 8 ? "ok" : "bad")} />
                <Ratio label="DER" hint="Utang / ekuitas. Makin rendah makin aman." value={fundamentals?.der ?? null} fmt={(v) => `${formatNumber(v, 1)}%`} rate={(v) => (v < 50 ? "good" : v < 100 ? "ok" : "bad")} />
                <Ratio label="Net margin" hint="Persentase laba bersih dari pendapatan." value={fundamentals?.netMargin ?? null} fmt={(v) => `${formatNumber(v, 1)}%`} rate={(v) => (v >= 15 ? "good" : v >= 5 ? "ok" : "bad")} />
                <Ratio label="Current ratio" hint="Aset lancar / utang lancar. >1,5 likuiditas sehat." value={fundamentals?.currentRatio ?? null} fmt={(v) => `${formatNumber(v, 2)}x`} rate={(v) => (v >= 1.5 ? "good" : v >= 1 ? "ok" : "bad")} />
                <Ratio label="Pertumbuhan pendapatan" hint="Year over year." value={fundamentals?.revenueGrowth ?? null} fmt={(v) => formatPercent(v, 1)} rate={(v) => (v >= 10 ? "good" : v >= 0 ? "ok" : "bad")} />
                <Ratio label="Pertumbuhan laba" hint="Year over year." value={fundamentals?.earningsGrowth ?? null} fmt={(v) => formatPercent(v, 1)} rate={(v) => (v >= 10 ? "good" : v >= 0 ? "ok" : "bad")} />
                <Ratio label="Beta 1 tahun" hint="Sensitivitas terhadap pasar. >1 lebih fluktuatif." value={stock.beta} fmt={(v) => formatNumber(v, 2)} />
                <Ratio label="Free float" hint="Porsi saham yang beredar di publik." value={stock.freeFloat} fmt={(v) => `${formatNumber(v, 1)}%`} />
              </div>

              {/* Harga wajar: Graham Number + PER & PBV emiten sejenis */}
              <div className="mt-4 rounded-xl border bg-muted/40 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">Estimasi Harga Wajar</p>
                    <p className="text-xs text-muted-foreground">
                      EPS {valuation.graham ? formatNumber(valuation.graham.eps, 0) : "-"} · BVPS{" "}
                      {valuation.graham ? formatNumber(valuation.graham.bvps, 0) : "-"}
                      {valuation.peers && (
                        <>
                          {" "}· pembanding: {valuation.peers.level} {valuation.peers.group} ({valuation.peers.count} emiten)
                        </>
                      )}
                    </p>
                  </div>
                  {valuation.average != null && (
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Rata-rata</p>
                      <p className="text-xl font-bold tabular-nums">{formatPrice(valuation.average)}</p>
                      <Upside price={stock.price} fair={valuation.average} />
                    </div>
                  )}
                </div>
                {valuation.list.length ? (
                  <ul className="mt-3 divide-y text-sm">
                    {valuation.list.map((f) => (
                      <li key={f.method} className="flex items-center justify-between gap-3 py-2">
                        <div className="min-w-0">
                          <p className="font-medium">{f.method}</p>
                          <p className="text-xs text-muted-foreground">{f.detail}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold tabular-nums">{formatPrice(f.value)}</p>
                          <Upside price={stock.price} fair={f.value} />
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">
                    Tidak dapat dihitung: butuh PER dan PBV positif (laba & ekuitas tidak boleh negatif).
                  </p>
                )}
                <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
                  Harga sekarang {formatPrice(stock.price)}. PER/PBV sektor = median emiten sejenis. Graham Number cocok untuk
                  laba yang stabil; kurang pas untuk saham bertumbuh tinggi, siklikal, atau bank. Bukan rekomendasi jual/beli.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5">
          <EntrySignalCard signal={signal} />

          {/* Analisa teknikal */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Lightbulb className="size-4 text-warn" /> Analisa Teknikal Sederhana
              </CardTitle>
              <p className="text-xs text-muted-foreground">Dihitung dari data harian 1 tahun terakhir.</p>
            </CardHeader>
            <CardContent className="space-y-4">
              {tech ? (
                <>
                  <dl className="grid grid-cols-2 gap-3 text-sm">
                    <Metric label="SMA 20" value={formatPrice(tech.sma20)} />
                    <Metric label="SMA 50" value={formatPrice(tech.sma50)} />
                    <Metric label="RSI 14" value={formatNumber(tech.rsi, 1)} />
                    <Metric label="MACD hist." value={formatNumber(tech.macdHist, 1)} />
                  </dl>
                  <ul className="space-y-2.5">
                    {tech.tips.map((t) => (
                      <li key={t.title} className={cn("rounded-lg border-l-4 bg-muted/50 p-3", toneBorder(t.tone))}>
                        <p className="text-sm font-semibold">{t.title}</p>
                        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{t.text}</p>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Data historis belum cukup untuk menghitung indikator.</p>
              )}
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Indikator teknikal hanya alat bantu, bukan rekomendasi. Selalu kombinasikan dengan analisa fundamental dan manajemen risiko.
              </p>
            </CardContent>
          </Card>

          {/* Kinerja */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Kinerja Harga</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-3 text-sm">
                {[
                  ["1 Mg", stock.returns.week],
                  ["1 Bln", stock.returns.month],
                  ["3 Bln", stock.returns.threeMonth],
                  ["6 Bln", stock.returns.sixMonth],
                  ["YTD", stock.returns.ytd],
                  ["1 Thn", stock.returns.year],
                ].map(([k, v]) => (
                  <div key={k as string}>
                    <p className="text-xs text-muted-foreground">{k}</p>
                    <ChangeText value={v as number | null} digits={1} className="font-semibold" />
                  </div>
                ))}
              </div>
              {range52 != null && (
                <div>
                  <p className="mb-1.5 text-xs text-muted-foreground">Rentang 52 minggu</p>
                  <div className="relative h-2 rounded-full bg-gradient-to-r from-down/60 via-warn/60 to-up/60">
                    <span
                      className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card bg-foreground"
                      style={{ left: `${Math.min(Math.max(range52, 0), 100)}%` }}
                      aria-hidden
                    />
                  </div>
                  <div className="mt-1 flex justify-between text-xs tabular-nums text-muted-foreground">
                    <span>{formatPrice(stock.low52)}</span>
                    <span>{formatPrice(stock.high52)}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Dividen */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Coins className="size-4 text-warn" /> Dividen
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {fundamentals?.dividendYield != null ? (
                <>
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <Metric label="Yield" value={`${formatNumber(fundamentals.dividendYield, 2)}%`} />
                    <Metric label="Payout" value={fundamentals.payoutRatio == null ? "-" : `${formatNumber(fundamentals.payoutRatio, 0)}%`} />
                    <Metric label="DPS (TTM)" value={formatNumber(fundamentals.dividendPerShare, 0)} />
                  </div>
                  {fundamentals.dividendHistory.length > 0 && (
                    <ul className="divide-y text-sm">
                      {fundamentals.dividendHistory.slice(0, 6).map((d) => (
                        <li key={d.date} className="flex justify-between py-1.5">
                          <span className="text-muted-foreground">{formatDate(d.date)}</span>
                          <span className="font-medium tabular-nums">Rp{formatNumber(d.amount, d.amount % 1 ? 2 : 0)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Belum ada data dividen untuk saham ini.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function toneBorder(t: Signal) {
  return t === "bullish" ? "border-up" : t === "bearish" ? "border-down" : "border-warn";
}

/** Diskon (hijau) bila harga di bawah harga wajar, premium (merah) bila di atas. */
function Upside({ price, fair }: { price: number; fair: number }) {
  const diff = (price / fair - 1) * 100;
  return (
    <p className={cn("text-xs font-medium tabular-nums", diff <= 0 ? "text-up" : "text-down")}>
      {diff <= 0 ? `Diskon ${formatNumber(-diff, 1)}%` : `Premium ${formatNumber(diff, 1)}%`}
    </p>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

function Ratio({
  label,
  hint,
  value,
  fmt,
  rate,
}: {
  label: string;
  hint: string;
  value: number | null;
  fmt: (v: number) => string;
  rate?: (v: number) => "good" | "ok" | "bad";
}) {
  const r = value != null && rate ? rate(value) : null;
  return (
    <div className="flex items-center justify-between gap-3 border-b py-2.5 last:border-0 sm:[&:nth-last-child(2)]:border-0">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <span
        className={cn(
          "shrink-0 rounded-md px-2 py-0.5 text-sm font-semibold tabular-nums",
          r === "good" && "bg-up-soft text-up",
          r === "ok" && "bg-warn-soft text-warn",
          r === "bad" && "bg-down-soft text-down",
          !r && "text-foreground",
        )}
      >
        {value == null ? "-" : fmt(value)}
      </span>
    </div>
  );
}
