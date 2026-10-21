'use client';

/**
 * AiAnalystHub.tsx
 *
 * On-demand AI reports for one ticker, one tab per report kind selected from
 * docs/features_prompt_ai.md (only prompts backed by data the app has):
 * - Riset         — narrative equity research report (existing)
 * - Trading Plan  — prompt 26–30: multi-timeframe, S/R, momentum, entry/SL/TP
 * - Bandarmology  — prompt 17–20: broker summary riil (Index Alpha) + Wyckoff proxy
 * - Foreign Flow  — prompt 22, 24, 25
 * - Valuasi       — prompt 11, 14, 15: relative to sector median, earnings yield, 3 scenarios
 *
 * Every prompt is built by src/domain/ai/promptBuilders.ts from computed data;
 * the model only narrates. Reports are generated on button press (no LLM call
 * per page view), and each tab keeps its own result while switching tabs.
 */

import { useRef, useState } from 'react';
import { AlertTriangle, BarChart3, FileText, Globe2, Loader2, RefreshCw, Scale, Sparkles, Target } from 'lucide-react';
import {
  AiReportKind,
  buildBandarPrompt,
  buildForeignPrompt,
  buildResearchPrompt,
  buildTradingPlanPrompt,
  buildValuationPrompt,
} from '@/domain/ai/promptBuilders';
import { FundamentalScreeningResult, TechnicalScreeningResult } from '@/domain/analysis/aiStockEngine';
import { computeBandarScore } from '@/domain/analysis/bandarScore';
import { measureSmartMoney } from '@/domain/analysis/smartMoneyHunter';
import { BrokerActivityDetail, SmartMoneyFlows } from '@/domain/models/BrokerSummary';
import { FundamentalDetail } from '@/domain/models/Fundamentals';
import { OHLCVBar } from '@/domain/models/History';
import { NewsSentimentSummary } from '@/domain/models/News';
import { StockSummary } from '@/domain/models/Stock';
import { StockAnalysis } from '@/domain/models/StockAnalysis';
import { getStockSmartMoneyFlows } from '@/data/repositories/StockRepository';
import { cn } from '@/lib/format';
import { useAiReport } from '@/presentation/features/ai/useAiReport';

interface Props {
  summary: StockSummary;
  analysis: StockAnalysis;
  bars: OHLCVBar[];
  fundamentals: FundamentalDetail | null;
  newsSummary: NewsSentimentSummary;
  fundamentalScreening: FundamentalScreeningResult;
  technicalScreening: TechnicalScreeningResult;
  brokerActivity: BrokerActivityDetail | null;
  allSummaries: StockSummary[];
}

type Mode = Exclude<AiReportKind, 'compare'>;

const MODES: Array<{ kind: Mode; label: string; icon: React.ReactNode; description: string; cta: string }> = [
  { kind: 'research', label: 'Riset', icon: <FileText className="size-3.5" strokeWidth={2.5} />, description: 'Laporan riset naratif: teknikal, fundamental & katalis sentimen, hingga ringkasan strategi trading.', cta: 'Buat Laporan Riset' },
  { kind: 'trading-plan', label: 'Trading Plan', icon: <Target className="size-3.5" strokeWidth={2.5} />, description: 'Tren multi-timeframe, level kunci, momentum RSI/MACD/Stochastic, dan rencana entry/SL/TP dengan cek Risk:Reward ≥ 1:2.', cta: 'Susun Trading Plan' },
  { kind: 'bandar', label: 'Bandarmology', icon: <BarChart3 className="size-3.5" strokeWidth={2.5} />, description: 'Baca broker summary riil 5 & 20 sesi: siapa yang akumulasi/distribusi, konsistensinya, konfirmasi vs divergensi harga, plus checklist harian.', cta: 'Analisa Bandarmology' },
  { kind: 'foreign', label: 'Foreign Flow', icon: <Globe2 className="size-3.5" strokeWidth={2.5} />, description: 'Tren net buy/sell asing, korelasinya dengan harga, kemungkinan penyebab, dan apakah layak jadi konfirmasi entry.', cta: 'Analisa Foreign Flow' },
  { kind: 'valuation', label: 'Valuasi', icon: <Scale className="size-3.5" strokeWidth={2.5} />, description: 'PER/PBV/ROE vs median sektor, earnings yield vs SBN 10 tahun, dan skenario target pesimis/basis/optimis.', cta: 'Nilai Valuasi' },
];

/** Optional, e.g. "6.45" — without it the valuation report explains the equity risk premium without an SBN figure. */
const SBN_10Y_YIELD = Number.parseFloat(process.env.NEXT_PUBLIC_SBN10Y_YIELD ?? '');

export function AiAnalystHub(props: Props) {
  const [active, setActive] = useState<Mode>('research');
  // Smart-flow costs Index Alpha quota on a cache miss: fetched once, only when a flow report is requested.
  const flowsRef = useRef<{ ticker: string; data: SmartMoneyFlows | null } | null>(null);

  async function loadFlows(): Promise<SmartMoneyFlows | null> {
    if (flowsRef.current?.ticker !== props.summary.ticker) {
      const res = await getStockSmartMoneyFlows(props.summary.ticker);
      flowsRef.current = { ticker: props.summary.ticker, data: res.ok ? res.data : null };
    }
    return flowsRef.current.data;
  }

  async function buildPrompt(kind: Mode): Promise<string> {
    const { summary, analysis, bars, fundamentals, newsSummary, brokerActivity, allSummaries } = props;
    switch (kind) {
      case 'research':
        return buildResearchPrompt(props);
      case 'trading-plan':
        return buildTradingPlanPrompt({ summary, analysis, bars });
      case 'valuation':
        return buildValuationPrompt({ summary, fundamentals, allSummaries, sbn10yYield: Number.isFinite(SBN_10Y_YIELD) ? SBN_10Y_YIELD : null });
      case 'bandar':
      case 'foreign': {
        const flows = await loadFlows();
        const measures = measureSmartMoney({ summary, bars, fundamentals, flows, now: new Date() });
        return kind === 'bandar'
          ? buildBandarPrompt({ summary, bars, bandarScore: computeBandarScore(summary, bars), brokerActivity, flows, measures })
          : buildForeignPrompt({ summary, bars, brokerActivity, flows, measures, fundamentals, newsSummary });
      }
    }
  }

  return (
    <section className="neo-border neo-shadow overflow-hidden bg-white dark:bg-zinc-900 rounded-xl sm:rounded-none">
      <div className="flex items-center gap-3 px-5 py-4 border-b-[3px] border-(--neo-line)">
        <span className="flex size-9 shrink-0 items-center justify-center neo-border bg-violet-500 text-white text-sm">
          <Sparkles className="size-4" strokeWidth={2.5} />
        </span>
        <div className="min-w-0">
          <h2 className="font-bold uppercase tracking-wide text-zinc-800 dark:text-zinc-100">AI Analyst</h2>
          <p className="text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 truncate">
            Analisa AI berbasis data {props.summary.ticker} — riset, trading plan, bandarmology, foreign flow, valuasi
          </p>
        </div>
      </div>

      <div role="tablist" aria-label="Jenis analisa AI" className="flex gap-1.5 overflow-x-auto px-5 pt-4">
        {MODES.map((m) => (
          <button
            key={m.kind}
            type="button"
            role="tab"
            aria-selected={active === m.kind}
            onClick={() => setActive(m.kind)}
            className={cn(
              'neo-press inline-flex shrink-0 items-center gap-1.5 neo-border px-3 py-1.5 text-xs font-bold',
              active === m.kind ? 'bg-violet-500 text-white' : 'bg-white text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'
            )}
          >
            {m.icon}
            {m.label}
          </button>
        ))}
      </div>

      {MODES.map((m) => (
        <ModePanel key={m.kind} mode={m} ticker={props.summary.ticker} hidden={active !== m.kind} buildPrompt={() => buildPrompt(m.kind)} />
      ))}
    </section>
  );
}

function ModePanel({
  mode,
  ticker,
  hidden,
  buildPrompt,
}: {
  mode: (typeof MODES)[number];
  ticker: string;
  hidden: boolean;
  buildPrompt: () => Promise<string>;
}) {
  const { state, markdown, html, error, generate } = useAiReport();
  const run = () => generate(mode.kind, buildPrompt);

  return (
    <div role="tabpanel" hidden={hidden} className="px-5 py-4">
      {state === 'idle' && (
        <div className="space-y-3">
          <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">{mode.description}</p>
          <button
            type="button"
            onClick={run}
            className="neo-press inline-flex items-center gap-2 neo-border neo-shadow-sm bg-violet-500 px-4 py-2 text-sm font-bold text-white"
          >
            {mode.icon}
            {mode.cta}
          </button>
        </div>
      )}

      {state === 'loading' && !markdown && (
        <div className="flex items-center gap-2 py-4 text-sm font-semibold text-zinc-400">
          <Loader2 className="size-4 animate-spin" strokeWidth={2.5} /> AI sedang menyusun analisa {mode.label} {ticker}…
        </div>
      )}

      {state === 'error' && (
        <div className="flex items-start gap-2.5 neo-border bg-rose-50 dark:bg-rose-400/10 px-4 py-3">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-rose-500" strokeWidth={2.5} />
          <div className="space-y-2">
            <p className="text-sm text-rose-700 dark:text-rose-300">{error}</p>
            <button
              type="button"
              onClick={run}
              className="neo-press inline-flex items-center gap-1.5 neo-border bg-white dark:bg-zinc-800 px-3 py-1.5 text-xs font-bold text-zinc-700 dark:text-zinc-200"
            >
              <RefreshCw className="size-3.5" strokeWidth={2.5} /> Coba Lagi
            </button>
          </div>
        </div>
      )}

      {html && (
        <>
          <div
            className="prose prose-zinc prose-sm max-w-none prose-headings:font-bold prose-headings:uppercase prose-headings:tracking-tight prose-table:text-sm prose-th:text-left dark:prose-invert overflow-x-auto"
            dangerouslySetInnerHTML={{ __html: html }}
          />
          {state !== 'loading' && (
            <button
              type="button"
              onClick={run}
              className="neo-press mt-4 inline-flex items-center gap-1.5 neo-border bg-white dark:bg-zinc-800 px-3 py-1.5 text-xs font-bold text-zinc-700 dark:text-zinc-200"
            >
              <RefreshCw className="size-3.5" strokeWidth={2.5} /> Buat Ulang
            </button>
          )}
        </>
      )}
    </div>
  );
}
