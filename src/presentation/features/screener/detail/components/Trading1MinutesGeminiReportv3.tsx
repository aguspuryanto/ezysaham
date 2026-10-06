'use client';

/**
 * Trading1MinutesGeminiReportv3.tsx
 *
 * EzySaham AI Decision Engine v3 card that renders exactly the output template of
 * docs/features_decision_enginev3_gemini.md: status → Alasan → (WAIT: Tunggu) → (BUY: Entry · Target · SL · R:R)
 * → Risiko → Kesimpulan. No technical detail outside the template.
 * The verdict comes from the deterministic engine (domain/analysis/decisionEngineV3.ts); this file only lays it out.
 */

import { Zap } from 'lucide-react';
import { ReactNode, useCallback, useMemo } from 'react';
import { FundamentalScreeningResult } from '@/domain/analysis/aiStockEngine';
import { buildFundamentalPillars } from '@/domain/analysis/fundamentalPillars';
import { FundamentalDetail } from '@/domain/models/Fundamentals';
import { OHLCVBar } from '@/domain/models/History';
import { StockSummary } from '@/domain/models/Stock';
import { StockAnalysis } from '@/domain/models/StockAnalysis';
import { cn } from '@/lib/format';
import { buildDecisionForStock } from '@/domain/analysis/decisionInput';
import { Caption, DECISION_TONE, LEVEL_TONE } from './gemini1m/primitives';
import { buildTemplateV3, TEMPLATE_EMOJI, templateV3Text } from './gemini1m/templateV3';
import { useSessionVwap } from './gemini1m/useSessionVwap';
import { CopyShareButton } from './TradingModesReport';
import { Badge, Card, PanelTitle, Skeleton } from './ui';

const STATUS_BORDER = {
  positive: 'border-emerald-300/70 dark:border-emerald-400/30',
  warning: 'border-amber-300/70 dark:border-amber-400/30',
  negative: 'border-rose-300/70 dark:border-rose-400/30',
} as const;

const RISK_LEVEL = { Rendah: 'LOW', Sedang: 'MEDIUM', Tinggi: 'HIGH' } as const;

function Block({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-lg bg-(--sv-surface) p-3', className)}>
      <Caption>{label}</Caption>
      <div className="mt-1 text-sm text-(--sv-text)">{children}</div>
    </div>
  );
}

export function Trading1MinutesGeminiReportv3({
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
  const ticker = summary.ticker;
  const { vwap } = useSessionVwap(ticker);

  const pillars = useMemo(
    () => buildFundamentalPillars(summary, fundamentals, fundamentalScreening),
    [summary, fundamentals, fundamentalScreening],
  );

  const t = useMemo(() => {
    const report = buildDecisionForStock({ summary, bars, analysis, fundamentals, pillars, vwap });
    return buildTemplateV3(ticker, report);
  }, [ticker, summary, bars, analysis, fundamentals, pillars, vwap]);
  const getShareText = useCallback(() => templateV3Text(t), [t]);
  const tone = DECISION_TONE[t.status];

  return (
    <Card aria-labelledby="ezy-v3-title">
      <PanelTitle icon={Zap} id="ezy-v3-title" action={<CopyShareButton getText={getShareText} />}>
        ⚡ EzySaham AI
      </PanelTitle>

      <div className={cn('m-4 space-y-3 rounded-xl border-2 p-4', STATUS_BORDER[tone as keyof typeof STATUS_BORDER])}>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-lg font-bold text-(--sv-text)">{t.ticker}</span>
          <Badge tone={tone} className="px-3 py-1 text-base">{TEMPLATE_EMOJI[t.status]} {t.status}</Badge>
        </div>

        <Block label="Alasan">
          <p className="text-[15px] font-medium leading-relaxed">&ldquo;{t.reason}&rdquo;</p>
        </Block>

        {t.waitFor && (
          <Block label="⏳ Tunggu" className="border border-amber-200 bg-amber-50/60 dark:border-amber-400/25 dark:bg-amber-400/5">
            <p>&ldquo;{t.waitFor}&rdquo;</p>
          </Block>
        )}

        {t.plan && (
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <Block label="📍 Entry"><span className="font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">{t.plan.entry}</span></Block>
            <Block label="🎯 Target">
              <span className="block font-semibold tabular-nums">TP1 {t.plan.tp1}</span>
              {t.plan.tp2 && <span className="block font-semibold tabular-nums">TP2 {t.plan.tp2}</span>}
            </Block>
            <Block label="🛑 Stop Loss"><span className="font-semibold tabular-nums text-rose-600 dark:text-rose-400">{t.plan.sl}</span></Block>
            <Block label="📊 Risk/Reward"><span className="font-semibold tabular-nums">{t.plan.rr}</span></Block>
          </div>
        )}

        <div className="grid gap-2 sm:grid-cols-[auto_minmax(0,1fr)]">
          <Block label="⚠️ Risiko">
            <Badge tone={LEVEL_TONE[RISK_LEVEL[t.risk]]}>{t.risk}</Badge>
          </Block>
          <Block label="💡 Kesimpulan">
            <p className="font-semibold">&ldquo;{t.conclusion}&rdquo;</p>
          </Block>
        </div>
      </div>

      <p className="px-4 pb-4 text-xs text-(--sv-muted)">Analisa otomatis berbasis data EOD + intraday tertunda. Edukasi, bukan ajakan jual/beli.</p>
    </Card>
  );
}

export function Trading1MinutesGeminiReportv3Skeleton() {
  return (
    <Card as="div" className="space-y-3 p-4">
      <Skeleton className="h-5 w-48" />
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-20" />
      <Skeleton className="h-16" />
    </Card>
  );
}
