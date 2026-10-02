'use client';

/**
 * Trading1MinutesGeminiReport.tsx
 *
 * "EzySaham AI" momentum vs speculation report (features_momentum.md) for the detail page's `.sv-theme`.
 * Four sections: Deteksi Momentum & Price Action · Anomali & Aksi Spekulasi · Valuasi & Value Trap ·
 * Actionable Trading Plan (BUY / WAIT / AVOID + Entry / TP1–TP3 / SL / Risk Gate) + kesimpulan 1 kalimat.
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
  MAX_RISK_PER_TRADE_PCT,
  MomentumSignal,
  MomentumStatus,
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

const num = (n: number | null | undefined): number | null => (n != null && Number.isFinite(n) ? n : null);
const pos = (n: number | null | undefined): number | null => (n != null && Number.isFinite(n) && n > 0 ? n : null);
const rpOr = (n: number | null | undefined) => (pos(n) != null ? fmtRp(n) : '—');

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

  const { candle, plan } = report;
  const entryZone = plan.entryLow != null && plan.entryHigh != null
    ? (plan.entryLow === plan.entryHigh ? fmtRp(plan.entryLow) : `${fmtRp(plan.entryLow)} – ${fmtRp(plan.entryHigh)}`)
    : '—';

  const getShareText = useCallback(() => {
    const checks = (cs: Check[]) => cs.map((c) => `• ${EMOJI[c.signal]} ${c.label}: ${c.value} — ${c.note}`);
    return [
      `⚡ ${ticker} — MOMENTUM vs SPEKULASI (EzySaham AI)`,
      [
        '1️⃣ DETEKSI MOMENTUM & PRICE ACTION',
        `• ${candle.emoji} Candle: ${candle.pattern} — ${candle.note}`,
        `• ${EMOJI[report.rvolCheck.signal]} RVOL: ${report.rvolCheck.value} — ${report.rvolCheck.note}`,
        ...checks(report.positionChecks),
        `→ ${EMOJI[report.momentumSignal]} ${report.momentumLabel} (skor ${report.momentumScore}/${report.momentumMax})`,
      ].join('\n'),
      [
        '2️⃣ ANOMALI & AKSI SPEKULASI',
        `• ${EMOJI[report.driver.signal]} Pendorong: ${report.driver.label}${report.driver.reasons.length ? ` (${report.driver.reasons.join(', ')})` : ''}`,
        `• ${EMOJI[report.liquidity.signal]} Likuiditas: ${report.liquidity.value} — ${report.liquidity.note}`,
        `• ${EMOJI[report.hotMoney.signal]} Hot money: ${report.hotMoney.level}`,
        ...report.hotMoney.flags.map((f) => `  ⚡ ${f}`),
      ].join('\n'),
      [
        '3️⃣ VALUASI & RISIKO VALUE TRAP',
        ...checks(report.valuationChecks),
        `→ ${EMOJI[report.valuationSignal]} ${report.valuationLabel}`,
        ...report.valuationWarnings.map((w) => `• ${w}`),
      ].join('\n'),
      [
        '4️⃣ ACTIONABLE TRADING PLAN',
        `Status: ${STATUS_EMOJI[plan.status]} ${plan.status} — ${plan.statusReason}`,
        `Setup: ${plan.setup}`,
        `Area Entry: ${entryZone}`,
        `Trigger: ${plan.entryTrigger}`,
        ...plan.targets.map((t) => `${t.label}: ${fmtRp(t.price)} (${fmtPct(t.gainPct, 1)}) — ${t.basis}`),
        `SL: ${rpOr(plan.sl)}${plan.riskPct != null ? ` (−${fmtNum(plan.riskPct, 1)}%)` : ''} — ${plan.slBasis}`,
        ...(plan.riskReward != null ? [`R:R: 1:${fmtNum(plan.riskReward, 1)}`] : []),
        ...(plan.validationErrors.length ? [`INVALID PLAN: ${plan.validationErrors.join(' · ')}`] : []),
        '',
        '🚨 RISK GATE:',
        ...plan.riskGate.map((g) => `• ${g}`),
        ...plan.sizing.map((s) => `• Modal ${fmtIdrValue(s.capital)} → risiko maks ${fmtIdrValue(s.maxLoss)} → maks ${s.maxLot != null ? `${fmtNum(s.maxLot)} lot` : '—'}`),
      ].join('\n'),
      `KESIMPULAN: ${report.conclusion}`,
      '⚠️ Analisa otomatis berbasis data EOD + intraday tertunda. Edukasi, bukan ajakan jual/beli.',
    ].join('\n\n');
  }, [ticker, candle, report, plan, entryZone]);

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

        {/* Verdict strip */}
        <div className="grid gap-2 text-sm sm:grid-cols-2 xl:grid-cols-4">
          {([
            ['Status', `${STATUS_EMOJI[plan.status]} ${plan.status}`, STATUS_TONE[plan.status]],
            ['Momentum', `${EMOJI[report.momentumSignal]} ${report.momentumLabel}`, TONE[report.momentumSignal]],
            ['Hot money', `${EMOJI[report.hotMoney.signal]} ${report.hotMoney.level}`, TONE[report.hotMoney.signal]],
            ['Valuasi', `${EMOJI[report.valuationSignal]} ${report.valuationLabel}`, TONE[report.valuationSignal]],
          ] as Array<[string, string, Tone]>).map(([label, value, tone]) => (
            <div key={label} className="flex items-center justify-between gap-2 rounded-lg bg-(--sv-surface) px-3 py-2">
              <span className="text-(--sv-muted)">{label}</span>
              <Badge tone={tone}>{value}</Badge>
            </div>
          ))}
        </div>

        {/* 1️⃣ MOMENTUM & PRICE ACTION */}
        <Section
          n="1️⃣"
          title="Deteksi Momentum & Price Action"
          verdict={<Signal signal={report.momentumSignal}>{report.momentumLabel} · {report.momentumScore >= 0 ? '+' : ''}{report.momentumScore}/{report.momentumMax}</Signal>}
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

        {/* 3️⃣ VALUASI & VALUE TRAP */}
        <Section n="3️⃣" title="Valuasi & Risiko Value Trap" verdict={<Signal signal={report.valuationSignal}>{report.valuationLabel}</Signal>}>
          <CheckList checks={report.valuationChecks} />
          {report.valuationWarnings.length > 0 ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50/60 p-3 text-rose-800 dark:border-rose-400/25 dark:bg-rose-400/5 dark:text-rose-200">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide">Peringatan risiko</p>
              <Bullets items={report.valuationWarnings} />
            </div>
          ) : (
            <p className="text-sm text-(--sv-muted)">🟢 Tidak ada ketidaksesuaian mencolok antara momentum dan valuasi.</p>
          )}
        </Section>

        {/* 4️⃣ TRADING PLAN */}
        <Section
          n="4️⃣"
          title="Actionable Trading Plan"
          verdict={<Badge tone={STATUS_TONE[plan.status]}>{STATUS_EMOJI[plan.status]} {plan.status}</Badge>}
        >
          <p className="text-sm text-(--sv-text)"><strong>{plan.status}</strong> — {plan.statusReason}.</p>
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <div className="rounded-lg border border-(--sv-border) bg-(--sv-surface) p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-(--sv-muted)">{plan.setup}</p>
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
          {plan.validationErrors.length > 0 && (
            <p className="text-xs font-medium text-rose-600 dark:text-rose-400">INVALID PLAN — {plan.validationErrors.join(' · ')}. Plan tidak boleh dieksekusi.</p>
          )}

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
        </Section>

        <div className="rounded-lg border border-(--sv-primary)/30 bg-(--sv-surface) p-3 text-sm">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-(--sv-muted)">Kesimpulan</p>
          <p className="font-medium leading-relaxed text-(--sv-text)">{report.conclusion}</p>
        </div>

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
      {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-40" />)}
    </Card>
  );
}
