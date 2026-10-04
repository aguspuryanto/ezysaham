'use client';

/**
 * Trading1MinutesGeminiReport.tsx
 *
 * "EzySaham AI" momentum vs speculation report for the detail page's `.sv-theme`, following the decision
 * hierarchy in docs/features_1menit_analisa_gemini.md:
 *   Final decision + separate scores (Fundamental · Valuation · Momentum · Liquidity · Risk)
 *   → Decision hierarchy (Data → Liquidity → Risk → Trend → Momentum → Entry, valuation = context)
 *   → 1️⃣ Momentum & price action · 2️⃣ Anomali & spekulasi · 3️⃣ Valuasi (konteks) · 4️⃣ Trading plan
 *   → kesimpulan + consistency check.
 * AVOID shows no setup / entry / TP / SL — only reasons and the conditions for the status to change.
 * All verdicts come from the deterministic engine in momentumSpeculation.ts; this file only lays them out.
 */

import { Loader2, Zap } from 'lucide-react';
import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { getStockIntraday } from '@/data/repositories/StockRepository';
import { FundamentalScreeningResult } from '@/domain/analysis/aiStockEngine';
import { buildFundamentalPillars } from '@/domain/analysis/fundamentalPillars';
import {
  buildMomentumReport,
  Check,
  fmtIdrValue,
  GateStatus,
  MAX_RISK_PER_TRADE_PCT,
  MomentumSignal,
  MomentumStatus,
  ScoreItem,
  SETUP_LABEL,
} from '@/domain/analysis/momentumSpeculation';
import { atr } from '@/domain/indicators/atr';
import { ema, lastValid } from '@/domain/indicators/movingAverages';
import { vwap as sessionVwap } from '@/domain/indicators/vwap';
import { FundamentalDetail } from '@/domain/models/Fundamentals';
import { OHLCVBar } from '@/domain/models/History';
import { IntradayResponse } from '@/domain/models/Intraday';
import { StockSummary } from '@/domain/models/Stock';
import { StockAnalysis } from '@/domain/models/StockAnalysis';
import { cn } from '@/lib/format';
import { fmtNum, fmtPct, fmtRp, Tone } from '../format';
import { CopyShareButton } from './TradingModesReport';
import { Badge, Card, PanelTitle, Skeleton } from './ui';

const EMOJI: Record<MomentumSignal, string> = { green: '🟢', yellow: '🟡', red: '🔴', na: '⚪' };
const TONE: Record<MomentumSignal, Tone> = { green: 'positive', yellow: 'warning', red: 'negative', na: 'neutral' };
const STATUS_TONE: Record<MomentumStatus, Tone> = { BUY: 'positive', WAIT: 'warning', AVOID: 'negative' };
const STATUS_EMOJI: Record<MomentumStatus, string> = { BUY: '🟢', WAIT: '🟡', AVOID: '🔴' };
const GATE_TONE: Record<GateStatus, Tone> = { PASS: 'positive', FAIL: 'negative', PENDING: 'warning', SKIPPED: 'neutral' };
const GATE_EMOJI: Record<GateStatus, string> = { PASS: '✅', FAIL: '❌', PENDING: '⏳', SKIPPED: '⏭️' };

const num = (n: number | null | undefined): number | null => (n != null && Number.isFinite(n) ? n : null);
const pos = (n: number | null | undefined): number | null => (n != null && Number.isFinite(n) && n > 0 ? n : null);
const rpOr = (n: number | null | undefined) => (pos(n) != null ? fmtRp(n) : '—');
const scoreTxt = (s: ScoreItem) => (s.value == null ? s.label : `${s.value}/100 · ${s.label}`);

// ─── Layout primitives ──────────────────────────────────────────────────────────

function Section({ n, title, verdict, children }: { n: string; title: string; verdict?: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-3 rounded-xl border border-(--sv-border) bg-(--sv-bg)/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-(--sv-text)">{n} {title}</h3>
        {verdict}
      </div>
      {children}
    </section>
  );
}

function CheckList({ checks }: { checks: Check[] }) {
  return (
    <ul className="divide-y divide-(--sv-border)/70 text-sm">
      {checks.map((c) => (
        <li key={c.label} className="flex flex-col gap-0.5 py-2 sm:flex-row sm:items-start sm:gap-3">
          <span className="shrink-0 text-(--sv-muted) sm:w-36">{EMOJI[c.signal]} {c.label}</span>
          <span className="min-w-0 flex-1">
            <span className="font-medium tabular-nums text-(--sv-text)">{c.value}</span>
            <span className="block text-xs text-(--sv-muted)">{c.note}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function Bullets({ items, className }: { items: string[]; className?: string }) {
  return (
    <ul className={cn('space-y-1 text-sm', className)}>
      {items.map((s) => (
        <li key={s} className="flex items-start gap-2">
          <span className="mt-2 size-1 shrink-0 rounded-full bg-current opacity-60" />
          {s}
        </li>
      ))}
    </ul>
  );
}

function Signal({ signal, children }: { signal: MomentumSignal; children: ReactNode }) {
  return <Badge tone={TONE[signal]}>{EMOJI[signal]} {children}</Badge>;
}

// ─── Component ──────────────────────────────────────────────────────────────────

export function Trading1MinutesGeminiReport({
  summary,
  bars,
  analysis,
  fundamentals,
  fundamentalScreening,
}: {
  summary: StockSummary;
  bars: OHLCVBar[];
  analysis: StockAnalysis;
  fundamentals: FundamentalDetail | null;
  fundamentalScreening: FundamentalScreeningResult;
}) {
  const { trendEma, indicators, volume, supportResistance } = analysis;
  const ticker = summary.ticker;
  const price = summary.lastClose;

  // Yahoo 1-minute feed for the session VWAP; keyed by ticker so a stale response is ignored.
  const [intradayState, setIntradayState] = useState<{ ticker: string; data: IntradayResponse } | null>(null);
  useEffect(() => {
    let cancelled = false;
    getStockIntraday(ticker).then((data) => {
      if (!cancelled) setIntradayState({ ticker, data });
    });
    return () => { cancelled = true; };
  }, [ticker]);
  const intraday = intradayState?.ticker === ticker ? intradayState.data : null;
  const intradayBars = intraday?.ok ? intraday.bars : null;
  const vwap = intradayBars && intradayBars.length > 0 ? sessionVwap(intradayBars) : null;

  const pillars = useMemo(
    () => buildFundamentalPillars(summary, fundamentals, fundamentalScreening),
    [summary, fundamentals, fundamentalScreening],
  );

  // EMA9 & ATR14 aren't part of StockAnalysis — derive from the same daily bars. EMA20/50 come from the engine.
  const ema9 = useMemo(() => pos(lastValid(ema(bars.map((b) => b.close), 9))), [bars]);
  const atr14 = useMemo(() => pos(lastValid(atr(bars, 14))), [bars]);

  const report = useMemo(() => buildMomentumReport({
    bars,
    price,
    change1D: num(summary.percentChange1D),
    change1W: num(summary.percentChange1W),
    change1M: num(summary.percentChange1M),
    annualHigh: pos(summary.annualHigh),
    ema9,
    ema20: pos(trendEma.ema20),
    ema50: pos(trendEma.ema50),
    vwap,
    rvol: pos(volume.relativeVolume),
    volumeMa20: pos(volume.volumeMa20),
    rsi14: num(indicators.rsi14),
    macdHistogram: num(indicators.macdHistogram),
    atr14,
    tradedValue: pos(summary.value),
    capitalization: pos(summary.capitalization),
    freeFloat: pos(summary.freeFloat),
    per: summary.per !== 0 ? num(summary.per) : null,
    pbv: pos(summary.pbv),
    roe: summary.roe !== 0 ? num(summary.roe) : null,
    revenueGrowth: num(fundamentals?.revenueGrowth),
    earningsGrowth: num(fundamentals?.earningsGrowth),
    valuationVerdict: pillars.valuation.verdict,
    fairValue: pillars.valuation.fairValue,
    supports: supportResistance.supports.map((s) => s.price),
    resistances: supportResistance.resistances.map((r) => r.price),
  }), [bars, price, summary, ema9, trendEma, vwap, volume, indicators, atr14, fundamentals, pillars, supportResistance]);

  const { candle, plan, scores } = report;
  const hasLevels = plan.planState !== 'none';
  const entryZone = plan.entryLow != null && plan.entryHigh != null
    ? (plan.entryLow === plan.entryHigh ? fmtRp(plan.entryLow) : `${fmtRp(plan.entryLow)} – ${fmtRp(plan.entryHigh)}`)
    : '—';
  const scoreTiles = useMemo((): Array<[string, ScoreItem]> => [
    ['Fundamental', scores.fundamental],
    ['Valuasi', scores.valuation],
    ['Momentum', scores.momentum],
    ['Likuiditas', scores.liquidity],
    ['Risiko', scores.risk],
  ], [scores]);

  const getShareText = useCallback(() => {
    const checks = (cs: Check[]) => cs.map((c) => `• ${EMOJI[c.signal]} ${c.label}: ${c.value} — ${c.note}`);
    const planLines = plan.planState === 'none'
      ? [
        `Status: ${STATUS_EMOJI[plan.status]} ${plan.status} — ${plan.statusReason}`,
        'Setup: TIDAK ADA — Entry/TP/SL/R:R tidak dihitung.',
        ...(plan.conditions.length ? ['Status bisa berubah bila:', ...plan.conditions.map((c) => `• ${c}`)] : []),
      ]
      : [
        `Status: ${STATUS_EMOJI[plan.status]} ${plan.status} — ${plan.statusReason}`,
        plan.planState === 'conditional' ? `${SETUP_LABEL[plan.setup]} (RENCANA BERSYARAT — bukan sinyal BUY)` : `Setup: ${SETUP_LABEL[plan.setup]}`,
        `Area Entry: ${entryZone}`,
        `Trigger: ${plan.entryTrigger ?? '—'}`,
        ...plan.targets.map((t) => `${t.label}: ${fmtRp(t.price)} (${fmtPct(t.gainPct, 1)}) — ${t.basis}`),
        `SL: ${rpOr(plan.sl)}${plan.riskPct != null ? ` (−${fmtNum(plan.riskPct, 1)}%)` : ''}${plan.slBasis ? ` — ${plan.slBasis}` : ''}`,
        ...(plan.riskReward != null ? [`R:R: 1:${fmtNum(plan.riskReward, 1)}`] : []),
        ...(plan.conditions.length ? ['Konfirmasi yang belum terpenuhi:', ...plan.conditions.map((c) => `• ${c}`)] : []),
        '',
        '🚨 RISK GATE:',
        ...plan.riskGate.map((g) => `• ${g}`),
        ...plan.sizing.map((s) => `• Modal ${fmtIdrValue(s.capital)} → risiko maks ${fmtIdrValue(s.maxLoss)} → maks ${s.maxLot != null ? `${fmtNum(s.maxLot)} lot` : '—'}`),
      ];
    return [
      `⚡ ${ticker} — MOMENTUM vs SPEKULASI (EzySaham AI)`,
      `KEPUTUSAN: ${STATUS_EMOJI[plan.status]} ${plan.status}`,
      ['SKOR', ...scoreTiles.map(([l, s]) => `• ${l}: ${scoreTxt(s)}`)].join('\n'),
      [
        'DECISION HIERARCHY',
        ...report.gates.map((g) => `• ${GATE_EMOJI[g.status]} ${g.label} — ${g.status}: ${g.reason}`),
        `• ℹ️ Valuation Context — ${report.valuationLabel} (konteks, tidak mengubah keputusan)`,
      ].join('\n'),
      [
        '1️⃣ DETEKSI MOMENTUM & PRICE ACTION',
        `• ${candle.emoji} Candle: ${candle.pattern} — ${candle.note}`,
        `• ${EMOJI[report.rvolCheck.signal]} RVOL: ${report.rvolCheck.value} — ${report.rvolCheck.note}`,
        ...checks(report.positionChecks),
        `→ ${EMOJI[report.momentumSignal]} ${scoreTxt(scores.momentum)}`,
      ].join('\n'),
      [
        '2️⃣ ANOMALI & AKSI SPEKULASI',
        `• ${EMOJI[report.driver.signal]} Pendorong: ${report.driver.label}${report.driver.reasons.length ? ` (${report.driver.reasons.join(', ')})` : ''}`,
        `• ${EMOJI[report.liquidity.signal]} Likuiditas: ${report.liquidity.value} — ${report.liquidity.note}`,
        `• ${EMOJI[report.hotMoney.signal]} Hot money: ${report.hotMoney.level}`,
        ...report.hotMoney.flags.map((f) => `  ⚡ ${f}`),
      ].join('\n'),
      [
        '3️⃣ VALUASI & RISIKO VALUE TRAP (konteks)',
        ...checks(report.valuationChecks),
        `→ ${EMOJI[report.valuationSignal]} ${report.valuationLabel}`,
        ...report.valuationWarnings.map((w) => `• ${w}`),
      ].join('\n'),
      ['4️⃣ TRADING PLAN', ...planLines].join('\n'),
      ['VALIDASI KONSISTENSI', ...report.consistency.map((c) => `• ${c.passed ? '✅' : '❌'} ${c.label}`)].join('\n'),
      `KESIMPULAN: ${report.conclusion}`,
      '⚠️ Analisa otomatis berbasis data EOD + intraday tertunda. Edukasi, bukan ajakan jual/beli.',
    ].join('\n\n');
  }, [ticker, candle, report, plan, scores, entryZone, scoreTiles]);

  return (
    <Card aria-labelledby="momentum-report-title">
      <PanelTitle icon={Zap} id="momentum-report-title" action={<CopyShareButton getText={getShareText} />}>
        ⚡ {ticker} — Momentum vs Spekulasi
      </PanelTitle>

      <div className="space-y-4 p-4">
        {intraday === null && (
          <p className="flex items-center gap-1.5 text-xs text-(--sv-muted)">
            <Loader2 className="size-3.5 animate-spin" /> Memuat data intraday (VWAP)…
          </p>
        )}

        {/* Final decision + separate scores */}
        <div className="grid gap-2 text-sm sm:grid-cols-2 xl:grid-cols-3">
          <div className="flex items-center justify-between gap-2 rounded-lg border border-(--sv-border) bg-(--sv-surface) px-3 py-2">
            <span className="font-semibold text-(--sv-text)">Keputusan Final</span>
            <Badge tone={STATUS_TONE[plan.status]} className="text-sm">{STATUS_EMOJI[plan.status]} {plan.status}</Badge>
          </div>
          {scoreTiles.map(([label, s]) => (
            <div key={label} className="flex items-center justify-between gap-2 rounded-lg bg-(--sv-surface) px-3 py-2">
              <span className="text-(--sv-muted)">
                {label}
                {label === 'Risiko' && <span className="text-[10px]"> (makin tinggi makin berisiko)</span>}
              </span>
              <Badge tone={TONE[s.signal]}>{EMOJI[s.signal]} {scoreTxt(s)}</Badge>
            </div>
          ))}
        </div>

        {/* Decision hierarchy */}
        <Section n="🧭" title="Decision Hierarchy" verdict={<Badge tone={STATUS_TONE[plan.status]}>{STATUS_EMOJI[plan.status]} {plan.status}</Badge>}>
          <ol className="divide-y divide-(--sv-border)/70 text-sm">
            {report.gates.map((g, idx) => (
              <li key={g.key} className="flex flex-col gap-1 py-2 sm:flex-row sm:items-start sm:gap-3">
                <span className="flex shrink-0 items-center gap-2 sm:w-60">
                  <span className="w-4 text-xs tabular-nums text-(--sv-muted)">{idx + 1}</span>
                  <span className="font-medium text-(--sv-text)">{g.label}</span>
                  <Badge tone={GATE_TONE[g.status]}>{GATE_EMOJI[g.status]} {g.status}</Badge>
                </span>
                <span className="min-w-0 flex-1 text-(--sv-muted)">{g.reason}</span>
              </li>
            ))}
            <li className="flex flex-col gap-1 py-2 sm:flex-row sm:items-start sm:gap-3">
              <span className="flex shrink-0 items-center gap-2 sm:w-60">
                <span className="w-4 text-xs tabular-nums text-(--sv-muted)">{report.gates.length + 1}</span>
                <span className="font-medium text-(--sv-text)">Valuation Context</span>
                <Badge tone="info">ℹ️ INFO</Badge>
              </span>
              <span className="min-w-0 flex-1 text-(--sv-muted)">{report.valuationLabel} — konteks saja, tidak bisa mengoverride gate di atas.</span>
            </li>
          </ol>
          <p className="text-xs text-(--sv-muted)">BUY = semua gate PASS · WAIT = belum cukup konfirmasi, risiko masih acceptable · AVOID = ada gate wajib yang FAIL.</p>
        </Section>

        {/* 1️⃣ MOMENTUM & PRICE ACTION */}
        <Section
          n="1️⃣"
          title="Deteksi Momentum & Price Action"
          verdict={<Signal signal={report.momentumSignal}>{scoreTxt(scores.momentum)}</Signal>}
        >
          <div className="rounded-lg bg-(--sv-surface) p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold text-(--sv-text)">{candle.emoji} {candle.pattern}</span>
              {candle.buyerPower != null && (
                <span className="text-xs text-(--sv-muted)">Buyer {fmtNum(candle.buyerPower, 0)}% · Seller {fmtNum(100 - candle.buyerPower, 0)}%</span>
              )}
            </div>
            {candle.buyerPower != null && (
              <div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-rose-500/70" aria-hidden="true">
                <div className="bg-emerald-500" style={{ width: `${candle.buyerPower}%` }} />
              </div>
            )}
            <p className="mt-2 text-(--sv-muted)">{candle.note}</p>
          </div>
          <CheckList checks={[report.rvolCheck, ...report.positionChecks]} />
          <p className="text-xs text-(--sv-muted)">
            Struktur EMA: {report.emaStack === 'bullish' ? '🟢 Harga > EMA 9 > EMA 20 > EMA 50 (tersusun naik)'
              : report.emaStack === 'bearish' ? '🔴 Harga < EMA 9 < EMA 20 < EMA 50 (tersusun turun)'
                : report.emaStack === 'mixed' ? '🟡 Campur — belum tersusun' : '—'}
            {vwap == null && intraday !== null && ' · VWAP tidak tersedia (feed intraday kosong).'}
          </p>
        </Section>

        {/* 2️⃣ ANOMALI & SPEKULASI */}
        <Section n="2️⃣" title="Anomali & Aksi Spekulasi Jangka Pendek" verdict={<Signal signal={report.hotMoney.signal}>Hot money {report.hotMoney.level}</Signal>}>
          <div className="rounded-lg bg-(--sv-surface) p-3 text-sm">
            <p className="font-semibold text-(--sv-text)">{EMOJI[report.driver.signal]} {report.driver.label}</p>
            {report.driver.reasons.length > 0 && <p className="mt-1 text-xs text-(--sv-muted)">{report.driver.reasons.join(' · ')}</p>}
          </div>
          <CheckList checks={[report.liquidity]} />
          {report.hotMoney.flags.length > 0 ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 text-amber-900 dark:border-amber-400/25 dark:bg-amber-400/5 dark:text-amber-200">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide">⚡ Tanda hot money / spekulasi ritel</p>
              <Bullets items={report.hotMoney.flags} />
            </div>
          ) : (
            <p className="text-sm text-(--sv-muted)">🟢 Tidak ada tanda hot money yang menonjol.</p>
          )}
        </Section>

        {/* 3️⃣ VALUASI & VALUE TRAP — context only */}
        <Section n="3️⃣" title="Valuasi & Risiko Value Trap (konteks)" verdict={<Signal signal={report.valuationSignal}>{report.valuationLabel}</Signal>}>
          <CheckList checks={report.valuationChecks} />
          {report.valuationWarnings.length > 0 ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50/60 p-3 text-rose-800 dark:border-rose-400/25 dark:bg-rose-400/5 dark:text-rose-200">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide">Peringatan risiko</p>
              <Bullets items={report.valuationWarnings} />
            </div>
          ) : (
            <p className="text-sm text-(--sv-muted)">🟢 Tidak ada ketidaksesuaian mencolok antara momentum dan valuasi.</p>
          )}
          <p className="text-xs text-(--sv-muted)">Valuasi murah / nilai wajar tinggi tidak pernah mengoverride Liquidity, Risk, atau Technical Gate.</p>
        </Section>

        {/* 4️⃣ TRADING PLAN */}
        <Section
          n="4️⃣"
          title="Actionable Trading Plan"
          verdict={<Badge tone={STATUS_TONE[plan.status]}>{STATUS_EMOJI[plan.status]} {plan.status}</Badge>}
        >
          <p className="text-sm text-(--sv-text)"><strong>{plan.status}</strong> — {plan.statusReason}.</p>

          {!hasLevels ? (
            <div
              className={cn(
                'rounded-lg border p-3 text-sm',
                plan.status === 'AVOID'
                  ? 'border-rose-200 bg-rose-50/60 text-rose-800 dark:border-rose-400/25 dark:bg-rose-400/5 dark:text-rose-200'
                  : 'border-amber-200 bg-amber-50/60 text-amber-900 dark:border-amber-400/25 dark:bg-amber-400/5 dark:text-amber-200',
              )}
            >
              <p className="font-semibold">
                {plan.status === 'AVOID'
                  ? 'Tidak ada setup aktif — Entry, TP, SL, R:R dan ukuran posisi tidak dihitung.'
                  : 'Belum ada setup valid — Entry, TP, SL dan R:R belum dihitung.'}
              </p>
              {plan.conditions.length > 0 && (
                <>
                  <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide">Status bisa berubah bila</p>
                  <Bullets items={plan.conditions} className="mt-1" />
                </>
              )}
            </div>
          ) : (
            <>
              {plan.planState === 'conditional' && (
                <p className="rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 text-xs font-medium text-amber-900 dark:border-amber-400/25 dark:bg-amber-400/5 dark:text-amber-200">
                  ⚠️ Rencana bersyarat — &quot;Buy Area&quot; ≠ BUY. Level di bawah baru boleh dieksekusi setelah semua konfirmasi terpenuhi.
                </p>
              )}
              <div className="grid gap-2 text-sm sm:grid-cols-2">
                <div className="rounded-lg border border-(--sv-border) bg-(--sv-surface) p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-(--sv-muted)">{SETUP_LABEL[plan.setup]}</p>
                  <p className="mt-1 text-base font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">{entryZone}</p>
                  <p className="mt-1 text-xs text-(--sv-muted)">{plan.entryTrigger}</p>
                </div>
                <div className="rounded-lg border border-(--sv-border) bg-(--sv-surface) p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-(--sv-muted)">Stop Loss</p>
                  <p className="mt-1 text-base font-semibold tabular-nums text-rose-600 dark:text-rose-400">
                    {rpOr(plan.sl)}{plan.riskPct != null && <span className="ml-1 text-xs font-medium">(−{fmtNum(plan.riskPct, 1)}%)</span>}
                  </p>
                  <p className="mt-1 text-xs text-(--sv-muted)">{plan.slBasis}</p>
                </div>
              </div>

              {plan.targets.length > 0 && (
                <div className="grid gap-2 text-sm sm:grid-cols-3">
                  {plan.targets.map((t) => (
                    <div key={t.label} className="rounded-lg bg-(--sv-surface) px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-(--sv-muted)">🎯 {t.label}</span>
                        <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">{fmtPct(t.gainPct, 1)}</span>
                      </div>
                      <p className="font-semibold tabular-nums text-(--sv-text)">{fmtRp(t.price)}</p>
                      <p className="text-[11px] text-(--sv-muted)">{t.basis}</p>
                    </div>
                  ))}
                </div>
              )}
              {plan.riskReward != null && (
                <p className="text-xs text-(--sv-muted)">Risk : Reward (ke TP1) = <strong className="text-(--sv-text)">1 : {fmtNum(plan.riskReward, 1)}</strong></p>
              )}

              <div className="rounded-lg bg-(--sv-surface) p-3">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-(--sv-muted)">Konfirmasi wajib sebelum BUY</p>
                <ul className="grid gap-1 text-sm sm:grid-cols-2">
                  {plan.confirmations.map((c) => (
                    <li key={c.label} className={cn('flex items-start gap-2', !c.ok && 'text-(--sv-muted)')}>
                      <span>{c.ok ? '✅' : '⏳'}</span>{c.label}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-lg border border-rose-200 bg-rose-50/60 p-3 text-rose-800 dark:border-rose-400/25 dark:bg-rose-400/5 dark:text-rose-200">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide">🚨 Risk Gate</p>
                <Bullets items={plan.riskGate} />
                <div className="mt-2 grid gap-1 text-xs sm:grid-cols-2">
                  {plan.sizing.map((s) => (
                    <p key={s.capital}>
                      Modal {fmtIdrValue(s.capital)} → risiko maks {fmtIdrValue(s.maxLoss)} ({MAX_RISK_PER_TRADE_PCT}%) → <strong>maks {s.maxLot != null ? `${fmtNum(s.maxLot)} lot` : '—'}</strong>
                    </p>
                  ))}
                </div>
              </div>
            </>
          )}
        </Section>

        <div className="rounded-lg border border-(--sv-primary)/30 bg-(--sv-surface) p-3 text-sm">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-(--sv-muted)">Kesimpulan</p>
          <p className="font-medium leading-relaxed text-(--sv-text)">{report.conclusion}</p>
        </div>

        <details className="rounded-lg bg-(--sv-surface) px-3 py-2 text-xs text-(--sv-muted)">
          <summary className="cursor-pointer font-semibold">
            Validasi konsistensi · {report.consistency.every((c) => c.passed) ? '✅ semua lolos' : `❌ ${report.consistency.filter((c) => !c.passed).length} gagal`}
          </summary>
          <ul className="mt-2 space-y-0.5">
            {report.consistency.map((c) => <li key={c.label}>{c.passed ? '✅' : '❌'} {c.label}</li>)}
          </ul>
        </details>

        <p className="text-xs leading-relaxed text-(--sv-muted)">
          Candlestick dibaca dari candle harian terakhir; VWAP dari feed 1 menit (kuotasi tertunda). Target adalah proyeksi, bukan janji profit.
          Edukasi, bukan ajakan jual/beli.
        </p>
      </div>
    </Card>
  );
}

export function Trading1MinutesGeminiReportSkeleton() {
  return (
    <Card as="div" className="space-y-4 p-4">
      <Skeleton className="h-5 w-72" />
      {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-40" />)}
    </Card>
  );
}
