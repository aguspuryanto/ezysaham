import Link from "next/link";
import { CircleAlert, CircleCheck, Info, ScanSearch, Sparkles, TriangleAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/misc";
import { TermTooltip } from "@/components/ui/TermTooltip";
import type { BedahSection, PointTone } from "@/lib/bedahData";
import type { BedahResult } from "@/lib/bedahAi";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

const TONE: Record<PointTone, { icon: typeof Info; className: string; label: string }> = {
  danger: { icon: TriangleAlert, className: "text-down", label: "Risiko tinggi" },
  warn: { icon: CircleAlert, className: "text-warn", label: "Perlu diperhatikan" },
  // Biru netral, bukan hijau primary: hijau di aplikasi ini berarti "baik/naik".
  info: { icon: Info, className: "text-sky-600 dark:text-sky-400", label: "Informasi" },
  good: { icon: CircleCheck, className: "text-up", label: "Tidak ada masalah" },
};

/** Narasi edukatif (AI atau aturan): kontradiksi data, fundamental vs harga, dan sinyal risiko. */
export function BedahDataCard({ symbol, result, asOf }: { symbol: string; result: BedahResult; asOf: string | null }) {
  const sections: BedahSection[] = result.sections;
  const ai = result.source === "ai";
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          <ScanSearch className="size-4 text-primary" /> Bedah Data {symbol}
          {ai && (
            <span className="inline-flex items-center gap-1 rounded-md bg-violet-500/10 px-1.5 py-0.5 text-xs font-medium text-violet-600 dark:text-violet-400">
              <Sparkles className="size-3" aria-hidden /> AI
            </span>
          )}
        </CardTitle>
        <p className="mt-1 text-xs text-muted-foreground">
          Membaca angka-angka di atas: mana yang janggal, apakah harga sejalan dengan kinerja, dan sinyal risiko apa yang perlu diwaspadai.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        {sections.map((sec, i) => (
          <section key={sec.key} aria-labelledby={`bedah-${sec.key}`}>
            <h3 id={`bedah-${sec.key}`} className="flex items-center gap-2 text-sm font-semibold">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs tabular-nums">{i + 1}</span>
              {sec.title}
            </h3>
            <ul className="mt-2 space-y-2">
              {sec.points.map((p) => {
                const t = TONE[p.tone];
                const Icon = t.icon;
                return (
                  <li key={p.text} className="flex gap-2.5 text-sm leading-relaxed">
                    <Icon className={cn("mt-0.5 size-4 shrink-0", t.className)} aria-label={t.label} />
                    <p className="text-muted-foreground">
                      {p.lead && <span className={cn("font-semibold", t.className)}>{p.lead}: </span>}
                      {p.text}
                    </p>
                  </li>
                );
              })}
            </ul>
            {sec.terms.length > 0 && (
              <p className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 pl-7 text-xs text-muted-foreground">
                <span>Pelajari:</span>
                {sec.terms.map((id) => (
                  <TermTooltip key={id} term={id} />
                ))}
              </p>
            )}
          </section>
        ))}
        <p className="border-t pt-3 text-[11px] leading-relaxed text-muted-foreground">
          {ai ? (
            <>
              Ditulis AI ({result.model}) dari data per {formatDate(asOf)}, lalu diperiksa otomatis agar tidak berisi ajakan jual/beli. AI bisa
              keliru, jadi cocokkan dengan angka di atas.
            </>
          ) : (
            <>Disusun otomatis dari data per {formatDate(asOf)} dengan aturan tetap, bukan oleh analis.</>
          )}{" "}
          Ini bahan belajar, bukan rekomendasi jual/beli. Istilah lain ada di{" "}
          <Link href="/glosarium" className="font-medium text-primary hover:underline">glosarium</Link>.
        </p>
      </CardContent>
    </Card>
  );
}

export function BedahDataSkeleton({ symbol }: { symbol: string }) {
  return (
    <Card aria-busy="true">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ScanSearch className="size-4 text-primary" /> Bedah Data {symbol}
        </CardTitle>
        <p className="mt-1 text-xs text-muted-foreground">Menyusun narasi dari data terbaru…</p>
      </CardHeader>
      <CardContent className="space-y-5">
        {[0, 1, 2].map((i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-56" />
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-11/12" />
            <Skeleton className="h-3.5 w-4/5" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
