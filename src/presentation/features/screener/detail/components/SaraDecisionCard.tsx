'use client';

/**
 * SaraDecisionCard.tsx
 *
 * SARA AI decision for the detail page: Fundamental / Valuasi / Timing kept apart, answering
 * WHY BUY? · WHY NOW? · WHERE WRONG?. All logic lives in domain/analysis/saraDecision.ts.
 */

import { AlertTriangle, Bot, CheckCircle2, Circle, ShieldAlert } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import type { FundamentalPillars } from '@/domain/analysis/fundamentalPillars';
import {
  computeSaraDecision,
  formatSaraDecision,
  SARA_DECISION_LABEL,
  SARA_DECISION_TONE,
  SaraConfidence,
} from '@/domain/analysis/saraDecision';
import type { StockAnalysis } from '@/domain/models/StockAnalysis';
import { cn } from '@/lib/format';
import { fmtRp, Tone } from '../format';
import { CopyShareButton } from './TradingModesReport';
import { Badge, Card, PanelTitle, TONE_TEXT } from './ui';

const DECISION_BOX: Record<Tone, string> = {
  positive: 'border-emerald-200 bg-emerald-50 dark:border-emerald-400/25 dark:bg-emerald-400/10',
  info: 'border-blue-200 bg-blue-50 dark:border-blue-400/25 dark:bg-blue-400/10',
  warning: 'border-amber-200 bg-amber-50 dark:border-amber-400/25 dark:bg-amber-400/10',
  negative: 'border-rose-200 bg-rose-50 dark:border-rose-400/25 dark:bg-rose-400/10',
  neutral: 'border-(--sv-border) bg-(--sv-bg)',
};

const CONFIDENCE_TONE: Record<SaraConfidence, Tone> = { HIGH: 'positive', MEDIUM: 'warning', LOW: 'negative' };

function Section({ emoji, title, children, className }: { emoji: string; title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-(--sv-muted)">{emoji} {title}</p>
      {children}
    </div>
  );
}

function Level({ label, value, tone }: { label: string; value: string; tone?: Tone }) {
  return (
    <div className="rounded-lg border border-(--sv-border) bg-(--sv-surface) px-3 py-2">
      <p className="text-[11px] text-(--sv-muted)">{label}</p>
      <p className={cn('text-sm font-semibold tabular-nums', tone ? TONE_TEXT[tone] : 'text-(--sv-text)')}>{value}</p>
    </div>
  );
}

export function SaraDecisionCard({
  ticker,
  price,
  pillars,
  analysis,
}: {
  ticker: string;
  price: number;
  pillars: FundamentalPillars;
  analysis: StockAnalysis;
}) {
  const [holding, setHolding] = useState(false);
  const d = useMemo(() => computeSaraDecision({ price, pillars, analysis, holding }), [price, pillars, analysis, holding]);
  const tone = SARA_DECISION_TONE[d.decision];
  const getShareText = useCallback(() => formatSaraDecision(ticker, d), [ticker, d]);

  return (
    <Card aria-labelledby="sara-decision-title">
      <PanelTitle icon={Bot} id="sara-decision-title" action={<CopyShareButton getText={getShareText} />}>
        SARA AI Decision
      </PanelTitle>

      <div className="space-y-4 p-4">
        {/* Owner toggle: entry decisions vs HOLD / REDUCE / SELL */}
        <div role="group" aria-label="Posisi saya" className="inline-flex rounded-lg border border-(--sv-border) bg-(--sv-bg) p-0.5 text-xs font-medium">
          {[{ v: false, label: 'Belum punya' }, { v: true, label: 'Sudah punya saham ini' }].map((o) => (
            <button
              key={o.label}
              type="button"
              aria-pressed={holding === o.v}
              onClick={() => setHolding(o.v)}
              className={cn(
                'rounded-md px-3 py-1.5 transition-colors',
                holding === o.v ? 'bg-(--sv-surface) text-(--sv-text) shadow-(--sv-shadow)' : 'text-(--sv-muted) hover:text-(--sv-text)',
              )}
            >
              {o.label}
            </button>
          ))}
        </div>

        {/* 📌 DECISION */}
        <div className={cn('rounded-xl border p-4', DECISION_BOX[tone])}>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-(--sv-muted)">📌 Decision</span>
            <Badge tone={tone} className="px-3 py-1 text-base">{SARA_DECISION_LABEL[d.decision]}</Badge>
            <Badge tone={CONFIDENCE_TONE[d.confidence.level]}>
              Confidence {d.confidence.level} · {d.confidence.passed}/{d.confidence.total}
            </Badge>
          </div>
          <p className={cn('mt-2 text-sm font-semibold', TONE_TEXT[tone])}>{d.headline}</p>
        </div>

        {/* 3 dimensions */}
        <div className="grid gap-3 sm:grid-cols-3">
          {d.dimensions.map((x, i) => (
            <div key={x.key} className="rounded-lg border border-(--sv-border) p-3">
              <p className="text-[11px] text-(--sv-muted)">{i + 1}. {x.title} — {x.question}</p>
              <Badge tone={x.tone} className="mt-1.5">{x.label}</Badge>
              <p className="mt-1.5 text-xs leading-relaxed text-(--sv-muted)">{x.detail}</p>
            </div>
          ))}
        </div>

        {/* 🚨 FOMO CHECK */}
        {d.fomo.triggered && (
          <div role="alert" className="flex gap-2.5 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm dark:border-rose-400/25 dark:bg-rose-400/10">
            <ShieldAlert className="mt-0.5 size-4 shrink-0 text-rose-600 dark:text-rose-400" />
            <div>
              <p className="font-semibold text-rose-700 dark:text-rose-300">🚨 FOMO CHECK — {d.fomo.message}</p>
              <ul className="mt-1 space-y-0.5 text-rose-700/90 dark:text-rose-200/90">
                {d.fomo.reasons.map((r) => <li key={r}>• {r}</li>)}
              </ul>
            </div>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <Section emoji="💡" title="Why buy?">
            {d.whyBuy.length > 0 ? (
              <ul className="space-y-1.5 text-sm text-(--sv-text)">
                {d.whyBuy.map((w) => (
                  <li key={w} className="flex gap-2"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />{w}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-(--sv-muted)">Belum ada alasan fundamental/valuasi yang kuat.</p>
            )}
          </Section>

          <Section emoji="⚡" title="Why now?">
            {d.hasEdge ? (
              <ul className="space-y-1.5 text-sm text-(--sv-text)">
                {d.whyNow.map((w) => (
                  <li key={w} className="flex gap-2"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />{w}</li>
                ))}
              </ul>
            ) : (
              <>
                <p className="flex items-center gap-1.5 text-sm font-semibold text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="size-4" /> BELUM ADA EDGE
                </p>
                <ul className="mt-1.5 space-y-1 text-sm text-(--sv-muted)">
                  {d.waitingFor.slice(0, 4).map((w) => (
                    <li key={w} className="flex gap-2"><Circle className="mt-1 size-3 shrink-0" />Menunggu: {w}</li>
                  ))}
                </ul>
              </>
            )}
          </Section>
        </div>

        {/* 🎯 ENTRY · 🛑 WHERE WRONG · 🎯 TARGET */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Level label="🎯 Entry" value={d.entry?.text ?? 'Belum valid'} tone={d.entry ? 'positive' : undefined} />
          <Level label="🛑 Where wrong (SL)" value={d.whereWrong ? fmtRp(d.whereWrong.price) : 'Belum jelas'} tone={d.whereWrong ? 'negative' : undefined} />
          <Level label="🎯 TP1" value={d.targets ? fmtRp(d.targets.tp1) : '—'} />
          <Level label="🎯 TP2" value={d.targets ? fmtRp(d.targets.tp2) : '—'} />
        </div>
        {d.whereWrong && <p className="-mt-2 text-xs leading-relaxed text-(--sv-muted)">🛑 {d.whereWrong.reason}</p>}

        {/* ⚖️ RISK/REWARD · 📊 CONFIDENCE */}
        <div className="grid gap-4 md:grid-cols-2">
          <Section emoji="⚖️" title="Risk / Reward">
            <p className={cn('text-sm font-medium', d.riskReward.ok ? TONE_TEXT.positive : TONE_TEXT.negative)}>{d.riskReward.text}</p>
          </Section>
          <Section emoji="📊" title={`Confidence — ${d.confidence.level}`}>
            <ul className="grid grid-cols-1 gap-1 text-xs sm:grid-cols-2">
              {d.confidence.checks.map((c) => (
                <li key={c.label} className="flex items-start gap-1.5" title={c.detail}>
                  {c.passed
                    ? <CheckCircle2 className="mt-px size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    : <Circle className="mt-px size-3.5 shrink-0 text-(--sv-muted)" />}
                  <span className={c.passed ? 'text-(--sv-text)' : 'text-(--sv-muted)'}>{c.label}</span>
                </li>
              ))}
            </ul>
          </Section>
        </div>

        <p className="text-xs leading-relaxed text-(--sv-muted)">
          Hierarki: Fundamental → Valuasi → Trend → Momentum → Volume → Entry → Risk/Reward. BUY NOW hanya muncul jika entry,
          invalidation, dan R:R jelas. Bukan ajakan jual/beli — keputusan & risiko sepenuhnya milik investor.
        </p>
      </div>
    </Card>
  );
}
