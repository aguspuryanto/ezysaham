import { ChevronDown, CircleAlert, CircleCheck, CircleMinus, CircleX, Crosshair, Flag, Siren, TriangleAlert } from "lucide-react";
import type { FomoResult } from "@/lib/fomoDetector";
import type { PhaseCriterion, PhaseFlag, PhaseStatus } from "@/lib/phaseFlag";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CheckStatus, EntrySignal, Verdict } from "@/lib/entrySignal";
import { formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import { TermTooltip } from "@/components/ui/TermTooltip";
import type { StrategyFit } from "@/lib/strategyFit";
import { StrategyFitBadges } from "./StrategyFitBadges";

type BoxStyle = { box: string; text: string };

const VERDICT_STYLE: Record<Verdict, BoxStyle> = {
  buy: { box: "border-up/40 bg-up-soft", text: "text-up" },
  accumulate: { box: "border-up/30 bg-up-soft", text: "text-up" },
  hold: { box: "border-warn/40 bg-warn-soft", text: "text-warn" },
  expensive: { box: "border-down/30 bg-down-soft", text: "text-down" },
  avoid: { box: "border-down/40 bg-down-soft", text: "text-down" },
};

const GREY_STYLE: BoxStyle = { box: "border-border bg-muted/40", text: "text-muted-foreground" };

/**
 * Ringkasan kondisi per verdict — bahasa informatif, bukan instruksi transaksi
 * (lihat docs/VERDICT_LABEL.md). Logika verdict tetap di lib/entrySignal.ts.
 */
const VERDICT_LABEL: Record<Verdict, string> = {
  buy: "Fundamental Kuat, Valuasi Diskon",
  accumulate: "Valuasi Diskon",
  hold: "Valuasi Wajar",
  expensive: "Valuasi Premium",
  avoid: "Fundamental Lemah",
};

/** Label kualitas, ambang sama dengan entrySignal (≥ 60 bagus, < 40 lemah). */
function qualityLabel(signal: EntrySignal) {
  if (!signal.checks.length) return "Data Kualitas Terbatas";
  if (signal.quality >= 60) return "Kualitas Tinggi";
  if (signal.quality >= 40) return "Kualitas Cukup";
  return "Kualitas Rendah";
}

/** Harga wajar tak bisa dihitung (laba/ekuitas negatif) → abu-abu, belum dapat dievaluasi. */
function headline(signal: EntrySignal): { title: string; style: BoxStyle } {
  if (signal.marginOfSafety == null) return { title: "Belum Dapat Dievaluasi", style: GREY_STYLE };
  return { title: VERDICT_LABEL[signal.verdict], style: VERDICT_STYLE[signal.verdict] };
}

const CHECK_ICON: Record<CheckStatus, React.ReactNode> = {
  pass: <CircleCheck className="size-4 shrink-0 text-up" />,
  warn: <CircleMinus className="size-4 shrink-0 text-warn" />,
  fail: <CircleX className="size-4 shrink-0 text-down" />,
};

const FLAG_STYLE: Record<PhaseStatus, BoxStyle & { label: string }> = {
  accumulation: { box: "border-up/40 bg-up-soft", text: "text-up", label: "KONDISI POSITIF · Pola Akumulasi Terdeteksi" },
  neutral: { box: "border-warn/40 bg-warn-soft", text: "text-warn", label: "PERLU KONFIRMASI · Momentum Belum Kuat" },
  fomo: { box: "border-down/40 bg-down-soft", text: "text-down", label: "WASPADA FOMO · Harga Sudah Menguat" },
  unknown: { ...GREY_STYLE, label: "DATA BELUM MEMADAI · Belum Dapat Dievaluasi" },
};

function CriteriaList({ title, items }: { title: string; items: PhaseCriterion[] }) {
  return (
    <div className="space-y-1">
      <p className="font-semibold text-foreground">{title}</p>
      <ul className="space-y-1">
        {items.map((c) => (
          <li key={c.label} className="flex gap-2">
            {c.met == null ? (
              <CircleMinus className="size-4 shrink-0 text-muted-foreground" />
            ) : c.met ? (
              <CircleCheck className="size-4 shrink-0 text-foreground" />
            ) : (
              <CircleX className="size-4 shrink-0 text-muted-foreground/60" />
            )}
            <span className="min-w-0">
              <span className={cn("font-medium", c.met ? "text-foreground" : "text-muted-foreground")}>{c.label}</span>
              <span className="text-muted-foreground"> — {c.text}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Status kondisi: pola akumulasi vs waspada FOMO, berbasis harga, volume, RSI & free float. */
function PhaseFlagBox({ flag }: { flag: PhaseFlag }) {
  const style = FLAG_STYLE[flag.status];
  if (flag.status === "unknown") {
    return (
      <div className={cn("rounded-xl border px-4 py-3 text-xs", style.box)}>
        <p className={cn("flex items-center gap-2 text-sm font-bold", style.text)}>
          <Flag className="size-4" /> {style.label}
        </p>
        <p className="mt-2 text-muted-foreground">{flag.action}</p>
      </div>
    );
  }
  return (
    <details className={cn("group rounded-xl border px-4 py-3 text-xs", style.box)}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
        <span className={cn("flex items-center gap-2 text-sm font-bold", style.text)}>
          <Flag className="size-4" /> {style.label}
        </span>
        <span className="flex items-center gap-1 text-muted-foreground tabular-nums">
          <span className="text-up">{flag.greenCount}/5</span>·<span className="text-down">{flag.redCount}/5</span>
          <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
        </span>
      </summary>
      <p className="mt-2 text-foreground">{flag.action}</p>
      <div className="mt-3 space-y-3">
        <CriteriaList title={`Pola akumulasi (${flag.greenCount}/5, butuh ≥ 3)`} items={flag.green} />
        <CriteriaList title={`Waspada FOMO (${flag.redCount}/5, butuh ≥ 2)`} items={flag.red} />
      </div>
    </details>
  );
}

/** Peringatan saat harga sudah terlalu tinggi atau bergerak terlalu cepat. */
function FomoDetectorList({ fomo }: { fomo: FomoResult }) {
  return (
    <div className="space-y-2">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <Siren className="size-4 text-down" /> FOMO Detector
      </p>
      {fomo.warnings.length ? (
        <ul className="space-y-1.5 text-sm">
          {fomo.warnings.map((w) => (
            <li key={w.key} className="flex gap-2">
              {w.tone === "bad" ? (
                <TriangleAlert className="size-4 shrink-0 text-down" />
              ) : (
                <CircleAlert className="size-4 shrink-0 text-warn" />
              )}
              <span className="min-w-0">
                <span className="font-medium">{w.title}</span>
                <span className="text-xs text-muted-foreground"> — {w.text}</span>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="flex gap-2 text-sm text-muted-foreground">
          <CircleCheck className="size-4 shrink-0 text-up" />
          Tidak ada tanda FOMO dari {fomo.checked} pemeriksaan harga, volume & momentum.
        </p>
      )}
    </div>
  );
}

/** Ringkasan kondisi saham berbasis fundamental: status, checklist, dan catatan timing. */
export function EntrySignalCard({
  signal,
  fits,
  flag,
  fomo,
}: {
  signal: EntrySignal;
  fits?: StrategyFit[];
  flag?: PhaseFlag;
  fomo?: FomoResult | null;
}) {
  const { title, style } = headline(signal);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Crosshair className="size-4 text-primary" /> Analisis Saham
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className={cn("flex items-center justify-between gap-3 rounded-xl border px-4 py-3", style.box)}>
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">{qualityLabel(signal)}</p>
            <p className={cn("text-xl font-bold leading-tight", style.text)}>{title}</p>
          </div>
          <div className="shrink-0 text-right text-xs text-muted-foreground tabular-nums">
            <p>Skor kualitas <span className="font-semibold text-foreground">{signal.quality}</span></p>
            {signal.marginOfSafety != null && (
              <p>
                <TermTooltip term="margin-of-safety">
                  {signal.marginOfSafety >= 0 ? "Estimasi diskon valuasi" : "Estimasi premium valuasi"}
                </TermTooltip>{" "}
                <span className={cn("font-semibold", signal.marginOfSafety >= 0 ? "text-up" : "text-down")}>
                  {formatPercent(Math.abs(signal.marginOfSafety), 1, false)}
                </span>
              </p>
            )}
          </div>
        </div>

        {fits && fits.length > 0 && (
          <div className="space-y-2">
            <StrategyFitBadges fits={fits} />
          </div>
        )}

        {flag && <PhaseFlagBox flag={flag} />}

        {/* {fomo && fomo.checked > 0 && <FomoDetectorList fomo={fomo} />} */}

        <div className="space-y-2">
          <p className="text-sm font-semibold">Checklist Fundamental</p>
          {signal.checks.length ? (
            <ul className="space-y-1.5 text-sm">
              {signal.checks.map((c) => (
                <li key={c.label} className="flex gap-2" title={c.text}>
                  {CHECK_ICON[c.status]}
                  <span className="min-w-0">
                    <span className="font-medium">{c.label}</span>
                    <span className="text-xs text-muted-foreground"> — {c.text}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Data rasio keuangan belum tersedia.</p>
          )}
        </div>

        {signal.timing.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-semibold">Timing (Teknikal)</p>
            <ul className="space-y-1.5 text-sm">
              {signal.timing.map((t) => (
                <li key={t.text} className="flex gap-2">
                  <span
                    className={cn(
                      "mt-1.5 size-2 shrink-0 rounded-full",
                      t.tone === "good" ? "bg-up" : t.tone === "bad" ? "bg-down" : "bg-warn",
                    )}
                  />
                  <span className="text-muted-foreground">{t.text}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Analisis otomatis berdasarkan data keuangan, valuasi, dan indikator teknikal. Informasi ini merupakan bahan
          pertimbangan, bukan rekomendasi jual atau beli.
        </p>
      </CardContent>
    </Card>
  );
}
