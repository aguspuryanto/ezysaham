import { CircleCheck, CircleMinus, CircleX, Crosshair } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CheckStatus, EntrySignal, Verdict } from "@/lib/entrySignal";
import { formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import { TermTooltip } from "@/components/ui/TermTooltip";
import type { StrategyFit } from "@/lib/strategyFit";
import { StrategyFitBadges } from "./StrategyFitBadges";

const VERDICT_STYLE: Record<Verdict, { box: string; text: string }> = {
  buy: { box: "border-up/40 bg-up-soft", text: "text-up" },
  accumulate: { box: "border-up/30 bg-up-soft", text: "text-up" },
  hold: { box: "border-warn/40 bg-warn-soft", text: "text-warn" },
  expensive: { box: "border-down/30 bg-down-soft", text: "text-down" },
  avoid: { box: "border-down/40 bg-down-soft", text: "text-down" },
};

/** Label ringkas per verdict. */
const VERDICT_LABEL: Record<Verdict, string> = {
  buy: "Layak Beli",
  accumulate: "Cicil Beli",
  hold: "Tunggu",
  expensive: "Mahal",
  avoid: "Hindari",
};

const CHECK_ICON: Record<CheckStatus, React.ReactNode> = {
  pass: <CircleCheck className="size-4 shrink-0 text-up" />,
  warn: <CircleMinus className="size-4 shrink-0 text-warn" />,
  fail: <CircleX className="size-4 shrink-0 text-down" />,
};

/** Sinyal entry ringkas berbasis fundamental: verdict, checklist, dan catatan timing. */
export function EntrySignalCard({ signal, fits }: { signal: EntrySignal; fits?: StrategyFit[] }) {
  const style = VERDICT_STYLE[signal.verdict];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Crosshair className="size-4 text-primary" /> Sinyal
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className={cn("flex items-center justify-between gap-3 rounded-xl border px-4 py-3", style.box)}>
          <p className={cn("text-xl font-bold", style.text)}>{VERDICT_LABEL[signal.verdict]}</p>
          <div className="text-right text-xs text-muted-foreground tabular-nums">
            <p>Skor kualitas <span className="font-semibold text-foreground">{signal.quality}</span></p>
            {signal.marginOfSafety != null && (
              <p>
                <TermTooltip term="margin-of-safety">{signal.marginOfSafety >= 0 ? "Diskon" : "Premium"}</TermTooltip>{" "}
                <span className={cn("font-semibold", signal.marginOfSafety >= 0 ? "text-up" : "text-down")}>
                  {formatPercent(Math.abs(signal.marginOfSafety), 1, false)}
                </span>
              </p>
            )}
          </div>
        </div>

        {fits && fits.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-semibold">Cocok untuk</p>
            <StrategyFitBadges fits={fits} />
          </div>
        )}

        <div className="space-y-2">
          <p className="text-sm font-semibold">Checklist</p>
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
            <p className="text-sm font-semibold">Timing (teknikal)</p>
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
          Dihitung otomatis dari rasio keuangan & median harga wajar. Bukan rekomendasi jual/beli.
        </p>
      </CardContent>
    </Card>
  );
}
