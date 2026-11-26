import { CircleAlert, CircleCheck, FileQuestion, Info, Radar, Sparkles, TriangleAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/misc";
import type { PointTone } from "@/lib/bedahData";
import type { ActionVerdict, RiskLevel } from "@/lib/anomaly";
import type { AnomalyResult } from "@/lib/anomalyAi";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

const TONE: Record<PointTone, { icon: typeof Info; className: string; label: string }> = {
  danger: { icon: TriangleAlert, className: "text-down", label: "Risiko tinggi" },
  warn: { icon: CircleAlert, className: "text-warn", label: "Perlu diperhatikan" },
  info: { icon: Info, className: "text-sky-600 dark:text-sky-400", label: "Informasi" },
  good: { icon: CircleCheck, className: "text-up", label: "Tidak ada masalah" },
};

const RISK: Record<RiskLevel, string> = {
  LOW: "bg-up-soft text-up",
  MEDIUM: "bg-warn-soft text-warn",
  HIGH: "bg-down-soft text-down",
  EXTREME: "bg-down text-white",
};

const ACTION: Record<ActionVerdict, { className: string; note: string }> = {
  BUY: { className: "bg-up-soft text-up", note: "Data mendukung untuk dipertimbangkan" },
  WATCH: { className: "bg-sky-500/10 text-sky-600 dark:text-sky-400", note: "Pantau dulu, tunggu kondisi berubah" },
  AVOID: { className: "bg-down-soft text-down", note: "Risiko melebihi yang bisa diukur" },
};

/** Hasil "Fundamental Anomaly Detector": 8 bagian sesuai docs/ANOMALY_FUNDAMENTAL.md. */
export function AnomalyCard({ symbol, result, asOf }: { symbol: string; result: AnomalyResult; asOf: string | null }) {
  const { sections, missing, risk, action, confidence } = result.report;
  const ai = result.source === "ai";
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          <Radar className="size-4 text-down" /> Deteksi Anomali Fundamental {symbol}
          {ai && (
            <span className="inline-flex items-center gap-1 rounded-md bg-violet-500/10 px-1.5 py-0.5 text-xs font-medium text-violet-600 dark:text-violet-400">
              <Sparkles className="size-3" aria-hidden /> AI
            </span>
          )}
        </CardTitle>
        <p className="mt-1 text-xs text-muted-foreground">
          Memeriksa konsistensi angka, kualitas fundamental, valuasi, kesesuaian harga dengan kinerja, dan risiko perdagangan.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Ringkasan: 7. risiko, 8. sikap, keyakinan */}
        <div className="grid gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-3">
          <div className="bg-card p-3">
            <p className="text-xs text-muted-foreground">7. Klasifikasi risiko</p>
            <span className={cn("mt-1 inline-block rounded-md px-2 py-0.5 text-sm font-bold", RISK[risk.level])}>{risk.level}</span>
          </div>
          <div className="bg-card p-3">
            <p className="text-xs text-muted-foreground">8. Sikap</p>
            <span className={cn("mt-1 inline-block rounded-md px-2 py-0.5 text-sm font-bold", ACTION[action.verdict].className)}>{action.verdict}</span>
            <p className="mt-1 text-[11px] text-muted-foreground">{ACTION[action.verdict].note}</p>
          </div>
          <div className="bg-card p-3">
            <p className="text-xs text-muted-foreground">Keyakinan (kelengkapan data)</p>
            <p className="mt-1 text-sm font-bold">
              {confidence.level} <span className="font-medium text-muted-foreground tabular-nums">· {confidence.pct}%</span>
            </p>
          </div>
        </div>

        {sections.map((sec, i) => (
          <section key={sec.key} aria-labelledby={`anomali-${sec.key}`}>
            <h3 id={`anomali-${sec.key}`} className="flex items-center gap-2 text-sm font-semibold">
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
          </section>
        ))}

        <section aria-labelledby="anomali-missing">
          <h3 id="anomali-missing" className="flex items-center gap-2 text-sm font-semibold">
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs tabular-nums">6</span>
            Missing Data
          </h3>
          <p className="mt-2 flex gap-2.5 text-sm leading-relaxed text-muted-foreground">
            <FileQuestion className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>{missing.join(", ")}.</span>
          </p>
        </section>

        <section aria-labelledby="anomali-final" className="rounded-xl border bg-muted/40 p-4">
          <h3 id="anomali-final" className="text-sm font-semibold">
            Risiko {risk.level} · {action.verdict}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">Faktor utama: {risk.reasons.join("; ")}.</p>
          <p className="mt-2 text-sm leading-relaxed">{action.reason}</p>
          <p className="mt-3 text-xs font-semibold text-muted-foreground">Kondisi pembatalan</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-muted-foreground">
            {action.invalidation.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </section>

        <p className="border-t pt-3 text-[11px] leading-relaxed text-muted-foreground">
          {ai ? <>Dianalisis AI ({result.model}) dari data per {formatDate(asOf)}. AI bisa keliru, jadi cocokkan dengan angka di atas.</> : <>Disusun otomatis dari data per {formatDate(asOf)} dengan aturan tetap.</>}{" "}
          Risiko tinggi tidak sama dengan sinyal jual. Sikap BUY/WATCH/AVOID adalah hasil penyaringan data, bukan nasihat investasi; keputusan dan risikonya
          tetap di tangan Anda.
        </p>
      </CardContent>
    </Card>
  );
}

export function AnomalySkeleton({ symbol }: { symbol: string }) {
  return (
    <Card aria-busy="true">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Radar className="size-4 text-down" /> Deteksi Anomali Fundamental {symbol}
        </CardTitle>
        <p className="mt-1 text-xs text-muted-foreground">Memeriksa konsistensi data…</p>
      </CardHeader>
      <CardContent className="space-y-5">
        <Skeleton className="h-16 w-full" />
        {[0, 1, 2].map((i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-4/5" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
