'use client';

/**
 * TradingMomentumReport.tsx
 *
 * Momentum Trade Engine report (docs/features_momentum_engine.md) on the detail page's `.sv-theme`:
 * Status · Momentum · Structure · Entry · SL · TP1 · TP2 · Potential · R:R · Exit Risk, the HARD RISK GATE
 * (6 × PASS/FAIL), then Alasan utama, Trigger Entry, Exit Warning, Kesimpulan and the analysis behind it.
 * Every verdict comes from domain/analysis/momentumTradeEngine.ts — this file only lays it out.
 */

import { Rocket } from 'lucide-react';
import { ReactNode, useCallback, useMemo } from 'react';
import { FundamentalScreeningResult } from '@/domain/analysis/aiStockEngine';
import { buildMomentumInput } from '@/domain/analysis/decisionInput';
import { buildFundamentalPillars } from '@/domain/analysis/fundamentalPillars';
import {
  buildMomentumTrade,
  ExitRisk,
  MOMENTUM_STATUS_EMOJI,
  MIN_MOMENTUM_RR,
  MOMENTUM_TARGET_PCT,
  MomentumGrade,
  MomentumSignalItem,
  MomentumTarget,
  MomentumTradeReport,
  MomentumTradeStatus,
  RiskGateItem,
  SETUP_NAME,
  StructureGrade,
} from '@/domain/analysis/momentumTradeEngine';
import { FundamentalDetail } from '@/domain/models/Fundamentals';
import { OHLCVBar } from '@/domain/models/History';
import { StockSummary } from '@/domain/models/Stock';
import { StockAnalysis } from '@/domain/models/StockAnalysis';
import { cn } from '@/lib/format';
import { fmtNum, fmtPct, fmtRp, Tone } from '../format';
import { Bullets, Callout, Caption, Section } from './gemini1m/primitives';
import { CopyShareButton } from './TradingModesReport';
import { Badge, Card, PanelTitle, Skeleton, TONE_TEXT } from './ui';

const STATUS_TONE: Record<MomentumTradeStatus, Tone> = {
  'MOMENTUM BUY': 'positive',
  'WAIT PULLBACK': 'warning',
  'WAIT BREAKOUT': 'warning',
  'AVOID CHASING': 'negative',
  'AVOID REVERSAL': 'negative',
  'NO TRADE': 'negative',
  'N/A': 'neutral',
};
const MOMENTUM_TONE: Record<MomentumGrade, Tone> = { STRONG: 'positive', MODERATE: 'warning', WEAK: 'negative', 'N/A': 'neutral' };
const STRUCTURE_TONE: Record<StructureGrade, Tone> = { HEALTHY: 'positive', EXTENDED: 'warning', DISTRIBUTION: 'negative', 'NO TREND': 'neutral', 'N/A': 'neutral' };
const EXIT_TONE: Record<ExitRisk, Tone> = { LOW: 'positive', MEDIUM: 'warning', HIGH: 'negative', EXTREME: 'negative', 'N/A': 'neutral' };

const NA = 'N/A';
const zoneText = (r: MomentumTradeReport) =>
  r.entryLow == null || r.entryHigh == null ? NA : r.entryLow === r.entryHigh ? fmtRp(r.entryLow) : `${fmtRp(r.entryLow)} – ${fmtNum(r.entryHigh)}`;
const targetText = (t: MomentumTarget | null) => (t ? `${fmtRp(t.price)} (${fmtPct(t.pct, 1)})` : NA);
const rrText = (rr: number | null) => (rr == null ? NA : `1:${fmtNum(rr, 1)}`);

function PlanTile({ label, children, sub, className }: { label: string; children: ReactNode; sub?: string | null; className?: string }) {
  return (
    <div className="rounded-lg border border-(--sv-border) bg-(--sv-surface) p-3">
      <Caption>{label}</Caption>
      <div className={cn('mt-1 font-semibold tabular-nums text-(--sv-text)', className)}>{children}</div>
      {sub && <p className="mt-0.5 text-[11px] leading-snug text-(--sv-muted)">{sub}</p>}
    </div>
  );
}

function SignalList({ items }: { items: MomentumSignalItem[] }) {
  if (items.length === 0) return <p className="text-sm text-(--sv-muted)">N/A</p>;
  return (
    <ul className="space-y-1 text-sm">
      {items.map((c) => (
        <li key={c.label} className={cn('flex items-start gap-2', !c.ok && 'text-(--sv-muted)')}>
          <span>{c.ok ? '✅' : '⚠️'}</span>{c.label}
        </li>
      ))}
    </ul>
  );
}

function RiskGate({ gates }: { gates: RiskGateItem[] }) {
  const passed = gates.filter((g) => g.pass).length;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Caption>🔒 Hard Risk Gate</Caption>
        <Badge tone={passed === gates.length ? 'positive' : 'negative'}>{passed}/{gates.length} PASS</Badge>
      </div>
      <ul className="grid gap-1.5 sm:grid-cols-2">
        {gates.map((g) => (
          <li key={g.key} className="flex items-start justify-between gap-2 rounded-lg bg-(--sv-surface) px-3 py-2 text-sm">
            <span className="min-w-0">
              <span className="font-medium text-(--sv-text)">{g.label}</span>
              <span className="block text-[11px] leading-snug text-(--sv-muted)">{g.detail}</span>
            </span>
            <Badge tone={g.pass ? 'positive' : 'negative'} className="shrink-0">{g.pass ? 'PASS' : 'FAIL'}</Badge>
          </li>
        ))}
      </ul>
    </div>
  );
}

function buildShareText(ticker: string, r: MomentumTradeReport): string {
  return [
    `🚀 Momentum Trade Engine — ${ticker}`,
    '',
    `Status: ${MOMENTUM_STATUS_EMOJI[r.status]} ${r.status}`,
    `Momentum: ${r.momentum}`,
    `Structure: ${r.structure}`,
    `Entry: ${zoneText(r)}${r.conditional ? ' (setelah trigger)' : ''}`,
    `SL: ${r.sl != null ? fmtRp(r.sl) : NA}`,
    `TP1: ${targetText(r.tp1)}`,
    `TP2: ${targetText(r.tp2)}`,
    `Potential: ${r.potentialPct != null ? fmtPct(r.potentialPct, 1) : NA}`,
    `R:R: ${rrText(r.riskReward)}`,
    `Exit Risk: ${r.exitRisk}`,
    '',
    'Risk Gate:',
    ...r.riskGate.map((g) => `${g.label}: ${g.pass ? 'PASS' : 'FAIL'}`),
    '',
    'Alasan utama:',
    ...r.reasons.map((s) => `- ${s}`),
    '',
    `Trigger Entry: ${r.trigger}`,
    '',
    'Exit Warning:',
    ...r.exitWarnings.map((s) => `- ${s}`),
    '',
    `Kesimpulan: ${r.conclusion}`,
  ].join('\n');
}

export function TradingMomentumReport({
  summary,
  bars,
  longBars,
  analysis,
  fundamentals,
  fundamentalScreening,
}: {
  summary: StockSummary;
  bars: OHLCVBar[];
  /** Longer daily history (2y chart bars) — only used so EMA 200 can be computed. */
  longBars?: OHLCVBar[];
  analysis: StockAnalysis;
  fundamentals: FundamentalDetail | null;
  fundamentalScreening: FundamentalScreeningResult;
}) {
  const ticker = summary.ticker;

  const report = useMemo(() => {
    const pillars = buildFundamentalPillars(summary, fundamentals, fundamentalScreening);
    return buildMomentumTrade(buildMomentumInput({ summary, bars, analysis, fundamentals, pillars, vwap: null, longBars }));
  }, [summary, bars, analysis, fundamentals, fundamentalScreening, longBars]);
  const getShareText = useCallback(() => buildShareText(ticker, report), [ticker, report]);

  const r = report;
  const tone = STATUS_TONE[r.status];
  const m = r.metrics;

  return (
    <Card aria-labelledby="momentum-engine-title">
      <PanelTitle icon={Rocket} id="momentum-engine-title" action={<CopyShareButton getText={getShareText} />}>
        Analisa Teknikal — {ticker}
      </PanelTitle>

      <div className="space-y-4 p-4">
        {/* Status & plan */}
        <div
          className={cn(
            'space-y-4 rounded-xl border-2 p-4',
            tone === 'positive' ? 'border-emerald-300/70 dark:border-emerald-400/30'
              : tone === 'negative' ? 'border-rose-300/70 dark:border-rose-400/30'
                : tone === 'warning' ? 'border-amber-300/70 dark:border-amber-400/30'
                  : 'border-(--sv-border)',
          )}
        >
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={tone} className="px-3 py-1 text-base">{MOMENTUM_STATUS_EMOJI[r.status]} {r.status}</Badge>
            {r.setup !== 'NONE' && <span className="text-xs text-(--sv-muted)">{SETUP_NAME[r.setup]}</span>}
          </div>

          <div className="grid grid-cols-3 gap-2">
            <PlanTile label="Momentum"><span className={TONE_TEXT[MOMENTUM_TONE[r.momentum]]}>{r.momentum}</span></PlanTile>
            <PlanTile label="Structure"><span className={TONE_TEXT[STRUCTURE_TONE[r.structure]]}>{r.structure}</span></PlanTile>
            <PlanTile label="Exit Risk"><span className={TONE_TEXT[EXIT_TONE[r.exitRisk]]}>{r.exitRisk}</span></PlanTile>
          </div>

          {r.entryLow != null ? (
            <div className="space-y-2">
              {r.conditional && (
                r.status === 'NO TRADE' ? (
                  <Callout tone="negative" className="text-xs">
                    Rencana acuan di bawah gagal Hard Risk Gate — hanya untuk evaluasi, bukan untuk dieksekusi.
                  </Callout>
                ) : (
                  <Callout tone="warning" className="text-xs">
                    Rencana bersyarat — baru berlaku setelah trigger entry terpenuhi. Entry zone ≠ sinyal BUY.
                  </Callout>
                )
              )}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <PlanTile label={r.status === 'NO TRADE' ? 'Entry (acuan)' : r.conditional ? 'Entry (setelah trigger)' : 'Entry'}>{zoneText(r)}</PlanTile>
                <PlanTile label="SL" className="text-rose-600 dark:text-rose-400" sub={r.slBasis}>{r.sl != null ? fmtRp(r.sl) : NA}</PlanTile>
                <PlanTile label="R:R" sub={`Ke TP2, min 1:${MIN_MOMENTUM_RR}`}>{rrText(r.riskReward)}</PlanTile>
                <PlanTile label="TP1" className="text-emerald-600 dark:text-emerald-400" sub={r.tp1?.basis}>{targetText(r.tp1)}</PlanTile>
                <PlanTile label="TP2" className="text-emerald-600 dark:text-emerald-400" sub={r.tp2?.basis}>{targetText(r.tp2)}</PlanTile>
                <PlanTile
                  label="Potential"
                  className={r.target20Realistic ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}
                  sub={r.target20Realistic ? `Target ≥${MOMENTUM_TARGET_PCT}% realistis` : `Target ≥${MOMENTUM_TARGET_PCT}% belum didukung resistance/volatilitas`}
                >
                  {r.potentialPct != null ? fmtPct(r.potentialPct, 1) : NA}
                </PlanTile>
              </div>
            </div>
          ) : (
            <p className="rounded-lg bg-(--sv-bg) px-3 py-2 text-sm text-(--sv-muted)">
              Entry, SL, TP & R:R: N/A — {r.dataOk ? 'tidak ada rencana entry saat risiko tinggi.' : r.dataNote}
            </p>
          )}

          {r.riskGate.length > 0 && <RiskGate gates={r.riskGate} />}

          <div className="space-y-1">
            <Caption>Alasan utama</Caption>
            <Bullets items={r.reasons} className="text-(--sv-text)" />
          </div>

          <p className={cn('text-sm font-semibold', TONE_TEXT[tone])}>{r.conclusion}</p>
        </div>

        {r.dataOk && (
          <>
            <div className="grid gap-3 md:grid-cols-2">
              <Section title="🎯 Trigger Entry">
                <p className="text-sm text-(--sv-text)">{r.trigger}</p>
              </Section>
              <Section title="🚨 Exit Warning">
                <Bullets items={r.exitWarnings} className="text-(--sv-text)" />
              </Section>
            </div>

            <details className="group rounded-xl border border-(--sv-border)">
              <summary className="cursor-pointer select-none px-4 py-3 text-sm font-semibold text-(--sv-text)">
                Detail analisis momentum
                <span className="ml-2 text-xs font-normal text-(--sv-muted)">
                  RSI {fmtNum(m.rsi14, 1)} · RVOL {m.rvol != null ? `${fmtNum(m.rvol, 1)}×` : NA} · ATR {fmtNum(m.atrPct, 1)}% · EMA 20 {fmtPct(m.distEma20Pct, 1)}
                </span>
              </summary>
              <div className="grid gap-3 p-4 pt-0 md:grid-cols-2">
                <Section title="1. Trend" verdict={<Badge tone={r.trend === 'BULLISH' ? 'positive' : r.trend === 'BEARISH' ? 'negative' : 'neutral'}>{r.trend}</Badge>}>
                  <SignalList items={r.checks.trend} />
                </Section>
                <Section title="2. Momentum" verdict={<Badge tone={MOMENTUM_TONE[r.momentum]}>{r.momentum}</Badge>}>
                  <SignalList items={r.checks.momentum} />
                </Section>
                <Section title="3. Volume" verdict={<Badge tone={r.volume === 'EXPANSION' ? 'positive' : 'neutral'}>{r.volume}</Badge>}>
                  <SignalList items={r.checks.volume} />
                </Section>
                <Section title="4. Structure · S/R" verdict={<Badge tone={r.setup === 'NONE' ? 'neutral' : 'positive'}>{SETUP_NAME[r.setup]}</Badge>}>
                  <SignalList items={r.checks.structure} />
                </Section>
                <Section title="5. Volatility">
                  <SignalList items={r.checks.volatility} />
                </Section>
                <Section title="6. Distribution & Reversal" verdict={<Badge tone={EXIT_TONE[r.exitRisk]}>{r.distributionFlags.length} tanda</Badge>}>
                  <SignalList items={r.checks.distribution} />
                </Section>
              </div>
            </details>
          </>
        )}

        <p className="text-xs leading-relaxed text-(--sv-muted)">
          “Momentum kuat bukan berarti BUY. BUY hanya jika momentum + entry + upside ≥{MOMENTUM_TARGET_PCT}% + R:R ≥1:{MIN_MOMENTUM_RR} + risk terkendali.”
          Analisa otomatis dari candle harian terakhir — target adalah proyeksi, bukan janji profit.
        </p>
      </div>
    </Card>
  );
}

export function TradingMomentumReportSkeleton() {
  return (
    <Card as="div" className="space-y-4 p-4">
      <Skeleton className="h-5 w-72" />
      <Skeleton className="h-64" />
      <Skeleton className="h-24" />
      <Skeleton className="h-12" />
    </Card>
  );
}
