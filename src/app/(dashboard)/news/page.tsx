import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, ChevronRight, Lightbulb } from "lucide-react";
import { ARTICLES } from "@/lib/articles";
import { fetchStocks } from "@/lib/api";
import { SCREENERS, marketBreadth, sectorPerformance } from "@/lib/screener";
import { formatPercent } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Tips & Edukasi" };
export const revalidate = 300;

async function getInsights(): Promise<string[]> {
  try {
    const stocks = await fetchStocks();
    const b = marketBreadth(stocks);
    const sectors = sectorPerformance(stocks);
    const best = sectors[0];
    const worst = sectors.at(-1);
    const momentum = SCREENERS.find((s) => s.key === "momentum")!.run(stocks).slice(0, 3);
    const out: string[] = [];
    const ratio = b.down ? b.up / b.down : b.up;
    out.push(
      ratio >= 1.3
        ? `Pasar sedang optimis: ${b.up} saham naik vs ${b.down} turun. Tetap disiplin, jangan FOMO mengejar harga.`
        : ratio <= 0.77
          ? `Pasar sedang tertekan: ${b.down} saham turun vs ${b.up} naik. Momen baik untuk mencatat saham incaran, bukan panik.`
          : `Pasar cenderung seimbang: ${b.up} saham naik dan ${b.down} turun.`,
    );
    if (best && worst && best.sector !== worst.sector)
      out.push(`Sektor terkuat hari ini ${best.sector} (${formatPercent(best.change)}), terlemah ${worst.sector} (${formatPercent(worst.change)}).`);
    if (momentum.length)
      out.push(`Saham dengan momentum terkuat: ${momentum.map((s) => s.symbol).join(", ")}. Cek RSI-nya — bila > 70, risiko koreksi meningkat.`);
    return out;
  } catch {
    return [];
  }
}

export default async function NewsPage() {
  const insights = await getInsights();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Tips & Edukasi</h1>
        <p className="text-sm text-muted-foreground">Materi singkat untuk investor pemula, plus insight otomatis dari data pasar hari ini.</p>
      </div>

      {insights.length > 0 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Lightbulb className="size-4 text-warn" /> Insight Pasar Hari Ini
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {insights.map((t) => (
                <li key={t} className="flex gap-2">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                  {t}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {ARTICLES.map((a) => (
          <Link key={a.slug} href={`/news/${a.slug}`} className="group">
            <Card className="flex h-full flex-col p-5 transition-colors group-hover:border-primary/50">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Badge variant={a.category === "Teknikal" ? "up" : a.category === "Fundamental" ? "default" : a.category === "Strategi" ? "warn" : "outline"}>
                  {a.category}
                </Badge>
                <span className="flex items-center gap-1"><BookOpen className="size-3" /> {a.minutes} menit</span>
              </div>
              <h2 className="mt-3 font-semibold leading-snug group-hover:text-primary">{a.title}</h2>
              <p className="mt-1.5 flex-1 text-sm text-muted-foreground">{a.summary}</p>
              <span className="mt-4 flex items-center text-sm font-medium text-primary">
                Baca <ChevronRight className="size-4" />
              </span>
            </Card>
          </Link>
        ))}
      </section>

      <p className="text-xs text-muted-foreground">
        Konten edukasi ini bersifat umum dan bukan ajakan membeli atau menjual saham tertentu. Lakukan riset mandiri sebelum berinvestasi.
      </p>
    </div>
  );
}
