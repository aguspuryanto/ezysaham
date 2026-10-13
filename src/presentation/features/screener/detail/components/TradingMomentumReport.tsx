'use client';

/**
 * TradingMomentumReport.tsx
 *
 * Momentum Trade Engine report (docs/features_momentum_engine.md) on the detail page's `.sv-theme`:
 * data header (timeframe · last candle · data status) → status + Opportunity Scanner (trend / momentum / setup)
 * → trading plan ONLY for BUY (otherwise the trigger condition, never a fake entry) → indicators → HARD RISK
 * GATE (PASS / FAIL / MENUNGGU per gate + FINAL GATE) → reasons, re-evaluation, risk & exit warnings → setups.
 * Every verdict comes from domain/analysis/momentumTradeEngine.ts — this file only lays it out.
 */

import { Rocket } from 'lucide-react';
import { ReactNode, useCallback, useMemo, useState } from 'react';
import { FundamentalScreeningResult } from '@/domain/analysis/aiStockEngine';
import { buildMomentumInput } from '@/domain/analysis/decisionInput';
import { buildFundamentalPillars } from '@/domain/analysis/fundamentalPillars';
import {
  buildMomentumTrade,
  ExitRisk,
  FinalGate,
  GateState,
  MOMENTUM_STATUS_EMOJI,
  MomentumGrade,
  MomentumSignalItem,
  MomentumTarget,
  MomentumTradeReport,
  MomentumTradeStatus,
  OpportunityGrade,
  RiskGateItem,
  SETUP_TYPE_NAME,
  SetupEval,
  SetupLevel,
  SetupState,
  StructureGrade,
} from '@/domain/analysis/momentumTradeEngine';
import { FundamentalDetail } from '@/domain/models/Fundamentals';
import { OHLCVBar } from '@/domain/models/History';
import { StockSummary } from '@/domain/models/Stock';
import { StockAnalysis } from '@/domain/models/StockAnalysis';
import { cn } from '@/lib/format';
import { fmtCompact, fmtNum, fmtPct, fmtRp, Tone } from '../format';
import { Bullets, Caption, Section } from './gemini1m/primitives';
import { CopyShareButton } from './TradingModesReport';
import { Badge, Card, PanelTitle, Skeleton, TONE_TEXT } from './ui';

const STATUS_TONE: Record<MomentumTradeStatus, Tone> = {
  BUY: 'positive',
  'WAIT PULLBACK': 'warning',
  'WAIT BREAKOUT': 'warning',
  'WAIT RETEST': 'warning',
  WATCHLIST: 'info',
  'AVOID CHASING': 'negative',
  'NO TRADE': 'negative',
};
const MOMENTUM_TONE: Record<MomentumGrade, Tone> = { STRONG: 'positive', MODERATE: 'warning', WEAK: 'negative', 'N/A': 'neutral' };
const STRUCTURE_TONE: Record<StructureGrade, Tone> = { HEALTHY: 'positive', EXTENDED: 'warning', DISTRIBUTION: 'negative', DOWNTREND: 'negative', 'NO TREND': 'neutral', 'N/A': 'neutral' };
const EXIT_TONE: Record<ExitRisk, Tone> = { LOW: 'positive', MEDIUM: 'warning', HIGH: 'negative', EXTREME: 'negative', 'N/A': 'neutral' };
const FINAL_GATE_TONE: Record<FinalGate, Tone> = { PASS: 'positive', BLOCKED: 'negative', 'N/A': 'neutral' };
const OPP_TONE: Record<OpportunityGrade, Tone> = { HIGH: 'positive', MEDIUM: 'warning', LOW: 'neutral', 'N/A': 'neutral' };
const GATE_TONE: Record<GateState, Tone> = { PASS: 'positive', FAIL: 'negative', PENDING: 'warning' };
const GATE_TEXT: Record<GateState, string> = { PASS: 'PASS', FAIL: 'FAIL', PENDING: 'PENDING' };
const LEVEL_ROLE: Record<SetupLevel['role'], string> = { BREAKOUT: 'Level breakout', ZONE_TOP: 'Atas zona', INVALIDATION: 'Invalidasi', RETEST_LOW: 'Low retest' };
const SETUP_STATE_TONE: Record<SetupState, Tone> = { TRIGGERED: 'positive', PENDING: 'warning', PRESENT: 'info', INVALID: 'negative', ABSENT: 'neutral' };
const SETUP_STATE_TEXT: Record<SetupState, string> = { TRIGGERED: 'TERPICU', PENDING: 'MENUNGGU', PRESENT: 'ADA', INVALID: 'GAGAL', ABSENT: 'TIDAK ADA' };
const DATA_TEXT = { OK: 'Valid', PROVISIONAL: 'Candle belum ditutup', STALE: 'Stale', SUSPECT: 'Perlu verifikasi', INSUFFICIENT: 'Tidak cukup' } as const;

const NA = 'N/A';
const zoneText = (r: MomentumTradeReport) =>
  r.entryLow == null || r.entryHigh == null ? NA : r.entryLow === r.entryHigh ? fmtRp(r.entryLow) : `${fmtRp(r.entryLow)} – ${fmtNum(r.entryHigh)}`;
const targetText = (t: MomentumTarget | null) => (t ? `${fmtRp(t.price)} (${fmtPct(t.pct, 1)})` : NA);
const rrText = (rr: number | null) => (rr == null ? NA : `1:${fmtNum(rr, 1)}`);
const isValidated = (r: MomentumTradeReport) => r.finalGate === 'PASS';

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

function RiskGate({ gates, finalGate }: { gates: RiskGateItem[]; finalGate: FinalGate }) {
  const passed = gates.filter((g) => g.pass).length;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Caption>🔒 Hard Risk Gate</Caption>
        <span className="text-xs text-(--sv-muted)">{passed}/{gates.length} PASS</span>
      </div>
      <ul className="grid gap-1.5 sm:grid-cols-2">
        {gates.map((g) => (
          <li key={g.key} className="flex items-start justify-between gap-2 rounded-lg bg-(--sv-surface) px-3 py-2 text-sm">
            <span className="min-w-0">
              <span className="font-medium text-(--sv-text)">{g.label}</span>
              <span className="block text-[11px] leading-snug text-(--sv-muted)">{g.detail}</span>
            </span>
            <Badge tone={GATE_TONE[g.state]} className="shrink-0">{GATE_TEXT[g.state]}</Badge>
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between gap-2 rounded-lg border border-(--sv-border) bg-(--sv-surface) px-3 py-2 text-sm">
        <span className="font-semibold text-(--sv-text)">FINAL GATE</span>
        <Badge tone={FINAL_GATE_TONE[finalGate]} className="shrink-0">{finalGate}</Badge>
      </div>
    </div>
  );
}

function IndicatorGrid({ r }: { r: MomentumTradeReport }) {
  const x = r.indicators;
  const dir = (a: number | null, b: number | null) => (a == null || b == null ? '' : a >= b ? ' ↑' : ' ↓');
  const macdState = x.macdLine == null || x.macdSignal == null ? NA
    : `${x.macdLine > x.macdSignal ? 'di atas' : 'di bawah'} signal, ${x.macdLine >= 0 ? '> 0' : '< 0'}`;
  const items: Array<[string, string, string?]> = [
    ['RSI 14', `${fmtNum(x.rsi14, 1)}${dir(x.rsi14, x.rsiPrev)}`, x.rsiPrev != null ? `kemarin ${fmtNum(x.rsiPrev, 1)}` : undefined],
    ['MACD', macdState, x.macdHistogram != null ? `histogram ${fmtNum(x.macdHistogram, 2)}${dir(x.macdHistogram, x.macdHistogramPrev)}` : undefined],
    ['EMA 9 / 20', `${fmtNum(x.ema9)} / ${fmtNum(x.ema20)}`, x.ema20Slope5Pct != null ? `EMA 20 ${fmtPct(x.ema20Slope5Pct, 1)} / 5 sesi` : undefined],
    ['EMA 50 / 200', `${fmtNum(x.ema50)} / ${x.ema200 != null ? fmtNum(x.ema200) : NA}`],
    ['ATR 14', `${fmtRp(x.atr14)} (${fmtNum(x.atrPct, 1)}%)`, `jarak EMA 20 = ${fmtNum(r.metrics.distEma20Atr, 1)}× ATR`],
    ['Relative Volume', x.rvol != null ? `${fmtNum(x.rvol, 1)}×` : NA, 'vs rata-rata 20 sesi sebelumnya'],
    ['Likuiditas', x.avgValue20 != null ? `Rp ${fmtCompact(x.avgValue20)}` : NA, 'rata-rata nilai transaksi 20 hari'],
  ];
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {items.map(([label, value, sub]) => <PlanTile key={label} label={label} sub={sub}>{value}</PlanTile>)}
    </div>
  );
}

/** Each key price with its own role — a breakout level, an invalidation and an SL basis are not the same support. */
function LevelList({ levels }: { levels: SetupLevel[] }) {
  return (
    <ul className="mt-1 space-y-0.5 text-xs">
      {[...levels].sort((a, b) => b.price - a.price).map((l) => (
        <li key={l.role} className="flex gap-2">
          <span className="w-28 shrink-0 tabular-nums font-medium text-(--sv-text)">{fmtRp(l.price)}</span>
          <span className="text-(--sv-muted)"><span className="font-medium">{LEVEL_ROLE[l.role]}</span> — {l.label}</span>
        </li>
      ))}
    </ul>
  );
}

function SetupList({ setups }: { setups: SetupEval[] }) {
  return (
    <ul className="space-y-2">
      {setups.map((s) => (
        <li key={s.type} className="rounded-lg bg-(--sv-surface) px-3 py-2 text-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium text-(--sv-text)">{SETUP_TYPE_NAME[s.type]}</span>
            <Badge tone={SETUP_STATE_TONE[s.state]}>{SETUP_STATE_TEXT[s.state]}</Badge>
          </div>
          <p className="mt-1 text-(--sv-text)">{s.reason}</p>
          {s.state !== 'ABSENT' && s.levels && <LevelList levels={s.levels} />}
          <p className="mt-1 text-[11px] leading-snug text-(--sv-muted)">
            Aktivasi: {s.activation}{s.state !== 'ABSENT' && s.invalidation !== '–' && <> · Invalidasi: {s.invalidation}</>}
          </p>
          {s.state !== 'ABSENT' && s.volumeRule && <p className="mt-1 text-[11px] leading-snug text-(--sv-muted)">Volume: {s.volumeRule}</p>}
        </li>
      ))}
    </ul>
  );
}

function buildShareText(ticker: string, r: MomentumTradeReport): string {
  const v = isValidated(r);
  return [
    `🚀 Momentum Trade Engine — ${ticker} (${r.config.label})`,
    `Timeframe ${r.data.timeframe} · candle ${r.data.lastBarDate ?? NA} · data ${DATA_TEXT[r.data.status]}`,
    '',
    `Status: ${MOMENTUM_STATUS_EMOJI[r.status]} ${r.status}`,
    `Trend Structure: ${r.structure} · Momentum: ${r.momentum} · Setup: ${SETUP_TYPE_NAME[r.setupType]}`,
    `RSI ${fmtNum(r.indicators.rsi14, 1)} · RVOL ${r.indicators.rvol != null ? `${fmtNum(r.indicators.rvol, 1)}×` : NA} · ATR ${fmtNum(r.indicators.atrPct, 1)}% · EMA 20 ${fmtPct(r.metrics.distEma20Pct, 1)}`,
    ...(v
      ? [`Entry: ${zoneText(r)}`, `SL: ${fmtRp(r.sl)}`, `TP1: ${targetText(r.tp1)}`, `TP2: ${targetText(r.tp2)}`, `Risiko: ${fmtNum(r.riskPct, 1)}% · R:R ${rrText(r.riskReward)} (net ${rrText(r.riskRewardNet)})`]
      : [`Entry: belum ada — ${r.entryCondition}`]),
    `Exit Risk: ${r.exitRisk}`,
    '',
    'HARD RISK GATE:',
    ...r.riskGate.map((g) => `${g.label}: ${GATE_TEXT[g.state]}`),
    `FINAL GATE: ${r.finalGate}`,
    '',
    'Alasan utama:',
    ...r.reasons.map((s) => `- ${s}`),
    '',
    `${v ? 'Trigger Entry' : 'Re-evaluation'}: ${r.trigger}`,
    ...(r.riskWarnings.length ? ['', 'Risk warning:', ...r.riskWarnings.map((s) => `- ${s}`)] : []),
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
  // Analysis time, fixed for this mount: enables the stale-data and unclosed-candle checks.
  const [asOf] = useState(() => new Date());

  const report = useMemo(() => {
    const pillars = buildFundamentalPillars(summary, fundamentals, fundamentalScreening);
    return buildMomentumTrade(buildMomentumInput({ summary, bars, analysis, fundamentals, pillars, vwap: null, longBars }), { mode: 'swing', asOf });
  }, [summary, bars, analysis, fundamentals, fundamentalScreening, longBars, asOf]);
  const getShareText = useCallback(() => buildShareText(ticker, report), [ticker, report]);

  const r = report;
  const tone = STATUS_TONE[r.status];
  const validated = isValidated(r);
  const candidate = r.setups.find((s) => s.type === r.setupType) ?? null;

  return (
    <Card aria-labelledby="momentum-engine-title">
      <PanelTitle icon={Rocket} id="momentum-engine-title" action={<CopyShareButton getText={getShareText} />}>
        Analisa Teknikal — {ticker}
      </PanelTitle>

      <div className="space-y-4 p-4">
        {/* Data header */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-(--sv-muted)">
          <span>Mode <span className="font-medium text-(--sv-text)">{r.config.label}</span></span>
          <span>Timeframe <span className="font-medium text-(--sv-text)">{r.data.timeframe}</span></span>
          <span>Candle terakhir <span className="font-medium text-(--sv-text)">{r.data.lastBarDate ?? NA}</span></span>
          <span>Data <Badge tone={r.data.status === 'OK' ? 'positive' : r.data.status === 'PROVISIONAL' ? 'warning' : 'negative'}>{DATA_TEXT[r.data.status]}</Badge></span>
        </div>

        {/* Status, scanner & plan */}
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
            {r.setupType !== 'NONE' && <span className="text-xs text-(--sv-muted)">{SETUP_TYPE_NAME[r.setupType]}</span>}
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <PlanTile label="Trend Structure"><span className={TONE_TEXT[STRUCTURE_TONE[r.structure]]}>{r.structure}</span></PlanTile>
            <PlanTile label="Momentum"><span className={TONE_TEXT[MOMENTUM_TONE[r.momentum]]}>{r.momentum}</span></PlanTile>
            <PlanTile label="Exit Risk"><span className={TONE_TEXT[EXIT_TONE[r.exitRisk]]}>{r.exitRisk}</span></PlanTile>
            <PlanTile label="Opportunity" sub="Analisa saja — bukan sinyal beli">
              <span className={TONE_TEXT[OPP_TONE[r.opportunity.grade]]}>{r.opportunity.grade}{r.opportunity.score != null && ` · ${r.opportunity.score}`}</span>
            </PlanTile>
          </div>

          {validated ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <PlanTile label="Entry zone">{zoneText(r)}</PlanTile>
              <PlanTile label="SL struktural" className="text-rose-600 dark:text-rose-400" sub={r.slBasis}>{fmtRp(r.sl)}</PlanTile>
              <PlanTile label="Risiko" sub="Entry − SL">{fmtNum(r.riskPct, 1)}%</PlanTile>
              <PlanTile label="TP1" className="text-emerald-600 dark:text-emerald-400" sub={r.tp1?.basis}>{targetText(r.tp1)}</PlanTile>
              <PlanTile label="TP2" className="text-emerald-600 dark:text-emerald-400" sub={r.tp2?.basis}>{targetText(r.tp2)}</PlanTile>
              <PlanTile label="R:R" sub={`Ke TP2 · net setelah biaya & slippage, min 1:${r.config.minRR}`}>
                {rrText(r.riskReward)} <span className="text-xs font-normal text-(--sv-muted)">(net {rrText(r.riskRewardNet)})</span>
              </PlanTile>
            </div>
          ) : (
            <div className="space-y-1 rounded-lg bg-(--sv-bg) px-3 py-2 text-sm">
              <p className="text-(--sv-muted)">
                {r.dataOk ? 'Belum ada trading plan — Entry, SL dan TP tidak ditampilkan sampai semua gate lulus.' : r.dataNote}
              </p>
              {r.dataOk && <p className="text-(--sv-text)">{r.entryCondition}</p>}
              {r.dataOk && candidate?.levels && candidate.state !== 'ABSENT' && <LevelList levels={candidate.levels} />}
              {r.slStage === 'PROVISIONAL' && (
                <p className="text-[11px] leading-snug text-(--sv-muted)">SL & R:R di gate adalah simulasi (PENDING ENTRY), bukan SL final — SL final baru ditetapkan setelah entry valid.</p>
              )}
            </div>
          )}

          {r.riskGate.length > 0 && <RiskGate gates={r.riskGate} finalGate={r.finalGate} />}

          <div className="space-y-1">
            <Caption>Alasan utama</Caption>
            <Bullets items={r.reasons} className="text-(--sv-text)" />
          </div>

          <p className={cn('text-sm font-semibold', TONE_TEXT[tone])}>{r.conclusion}</p>
        </div>

        {r.dataOk && (
          <>
            <IndicatorGrid r={r} />

            <div className="grid gap-3 md:grid-cols-2">
              <Section title={validated ? '🎯 Trigger Entry' : '🔁 Re-evaluation'}>
                <p className="text-sm text-(--sv-text)">{r.trigger}</p>
              </Section>
              <Section title="⚠️ Risk Warning">
                {r.riskWarnings.length ? <Bullets items={r.riskWarnings} className="text-(--sv-text)" /> : <p className="text-sm text-(--sv-muted)">Tidak ada peringatan khusus.</p>}
              </Section>
            </div>

            <Section title="🚨 Exit Warning">
              <Bullets items={r.exitWarnings} className="text-(--sv-text)" />
            </Section>

            <details className="group rounded-xl border border-(--sv-border)">
              <summary className="cursor-pointer select-none px-4 py-3 text-sm font-semibold text-(--sv-text)">
                Detail setup & indikator
                <span className="ml-2 text-xs font-normal text-(--sv-muted)">trigger · invalidasi · cek per area</span>
              </summary>
              <div className="space-y-3 p-4 pt-0">
                <Section title="Setup teknikal">
                  <SetupList setups={r.setups} />
                </Section>
                <div className="grid gap-3 md:grid-cols-2">
                  <Section title="1. Trend" verdict={<Badge tone={r.trend === 'BULLISH' ? 'positive' : r.trend === 'BEARISH' ? 'negative' : 'neutral'}>{r.trend}</Badge>}>
                    <SignalList items={r.checks.trend} />
                  </Section>
                  <Section title="2. Momentum" verdict={<Badge tone={MOMENTUM_TONE[r.momentum]}>{r.momentum}</Badge>}>
                    <SignalList items={r.checks.momentum} />
                  </Section>
                  <Section title="3. Volume & likuiditas" verdict={<Badge tone={r.volume === 'EXPANSION' ? 'positive' : 'neutral'}>{r.volume}</Badge>}>
                    <SignalList items={r.checks.volume} />
                  </Section>
                  <Section title="4. Volatilitas">
                    <SignalList items={r.checks.volatility} />
                  </Section>
                  <Section title="5. Struktur · S/R">
                    <SignalList items={r.checks.structure} />
                  </Section>
                  <Section title="6. Distribusi & reversal" verdict={<Badge tone={EXIT_TONE[r.exitRisk]}>{r.distributionFlags.length} tanda</Badge>}>
                    <SignalList items={r.checks.distribution} />
                  </Section>
                </div>
              </div>
            </details>
          </>
        )}

        <p className="text-xs leading-relaxed text-(--sv-muted)">
          BUY hanya jika semua Hard Risk Gate lulus; WAIT / WATCHLIST bukan sinyal beli. Potential = entry → TP2 (target teknikal);
          Upside = entry → resistance terdekat; R:R net memperhitungkan fee broker & slippage. Indikator dihitung dari candle harian
          aplikasi (Yahoo Finance, close terakhir) — bisa berbeda dari TradingView karena timeframe, periode, sumber harga atau waktu snapshot.
          Target adalah proyeksi, bukan janji profit.
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
