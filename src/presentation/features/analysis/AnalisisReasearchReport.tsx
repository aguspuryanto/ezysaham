'use client';

/**
 * AnalisisReasearchReport.tsx
 *
 * "Analisis Research Report" — sends the fully-computed stock analysis
 * (technical, fundamental, sentiment, system trading plan) to an LLM via the
 * Puter.js client already loaded globally by AIChatWidget (see
 * src/app/layout.tsx) with a fixed system prompt that produces a narrative
 * equity research report: overview, technical analysis, fundamental &
 * sentiment catalysts, and a trading strategy summary table — matching the
 * report shape documented in feature_analisa_saham.md. Generated on-demand
 * (button) rather than auto-fired, matching AiAnalystEngineCard's UX and
 * avoiding an LLM call on every page view.
 */

import { useMemo, useState } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { AlertTriangle, FileText, Loader2, RefreshCw } from 'lucide-react';
import { StockSummary } from '@/domain/models/Stock';
import { StockAnalysis } from '@/domain/models/StockAnalysis';
import { FundamentalDetail } from '@/domain/models/Fundamentals';
import { NewsSentimentSummary } from '@/domain/models/News';
import { FundamentalScreeningResult, TechnicalScreeningResult } from '@/domain/analysis/aiStockEngine';
import { cn, formatCompact } from '@/lib/format';


interface Props {
  summary: StockSummary;
  analysis: StockAnalysis;
  fundamentals: FundamentalDetail | null;
  newsSummary: NewsSentimentSummary;
  fundamentalScreening: FundamentalScreeningResult;
  technicalScreening: TechnicalScreeningResult;
}

function fmtOrNa(value: number | null | undefined, suffix = ''): string {
  if (value == null || Number.isNaN(value)) return 'N/A';
  return `${value.toFixed(1)}${suffix}`;
}

function buildUserPrompt({
  summary,
  analysis,
  fundamentals,
  newsSummary,
  fundamentalScreening,
  technicalScreening,
}: Props): string {
  const { trendEma, indicators, volume, supportResistance, tradingPlan } = analysis;
  const nearestResistance = supportResistance.resistances[0];
  const nearestSupport = supportResistance.supports[0];
  const bias = tradingPlan.recommendedBias === 'bearish' ? 'bearish' : 'bullish';
  const scenario = tradingPlan[bias];

  return `[KODE_SAHAM]: ${summary.ticker} — ${summary.name}
Sektor: ${summary.sector} / ${summary.subSector}
Harga Saat Ini: Rp${summary.lastClose} (${summary.percentChange1D >= 0 ? '+' : ''}${summary.percentChange1D.toFixed(2)}% hari ini)

=== TEKNIKAL ===
- Tren: ${trendEma.trend} — ${trendEma.trendDescription}
- EMA20: Rp${trendEma.ema20.toFixed(0)} | EMA50: Rp${trendEma.ema50.toFixed(0)} | EMA200: Rp${trendEma.ema200.toFixed(0)}
- Harga vs EMA20: ${trendEma.priceVsEma20} | vs EMA50: ${trendEma.priceVsEma50}
- RSI14: ${indicators.rsi14.toFixed(1)} (${indicators.rsiZone}) — ${indicators.rsiNote}
- MACD: value ${indicators.macdValue.toFixed(2)}, signal ${indicators.macdSignal.toFixed(2)} → ${indicators.macdSignalType}
- Resistance Terdekat: ${nearestResistance ? `Rp${nearestResistance.price.toFixed(0)} (${nearestResistance.label})` : 'tidak terdeteksi'}
- Support Terdekat: ${nearestSupport ? `Rp${nearestSupport.price.toFixed(0)} (${nearestSupport.label})` : 'tidak terdeteksi'}
- RVOL (Relative Volume): ${volume.relativeVolume.toFixed(2)}x, tren volume ${volume.volumeTrend}

=== FUNDAMENTAL ===
- PER: ${summary.per > 0 ? `${summary.per.toFixed(1)}x` : 'N/A'} (status valuasi: ${fundamentalScreening.perStatus.tone})
- PBV: ${summary.pbv > 0 ? `${summary.pbv.toFixed(2)}x` : 'N/A'}
- ROE: ${summary.roe !== 0 ? `${summary.roe.toFixed(1)}%` : 'N/A'}
- Market Cap: ${formatCompact(summary.capitalization)}
- Dividend Yield: ${fmtOrNa(fundamentals?.dividendYield ?? null, '%')}
- Debt to Equity: ${fmtOrNa(fundamentals?.debtToEquity ?? null, '%')}
- Net Margin: ${fmtOrNa(fundamentals?.netMargin ?? null, '%')}
- Revenue Growth YoY: ${fmtOrNa(fundamentals?.revenueGrowth ?? null, '%')}

=== SENTIMEN BERITA ===
- Total Berita: ${newsSummary.totalNews} (Bullish ${newsSummary.bullishCount} / Bearish ${newsSummary.bearishCount} / Netral ${newsSummary.neutralCount})
- Sentimen Keseluruhan: ${newsSummary.overallSentiment} (skor bersih ${newsSummary.netSentimentScore}/100)

=== SKOR SCREENING INTERNAL (referensi tambahan) ===
- Skor Fundamental: ${fundamentalScreening.score}/100 — ${fundamentalScreening.statusText}
- Skor Teknikal: ${technicalScreening.score}/100 — ${technicalScreening.statusText}

=== RENCANA TRADING SISTEM (gunakan angka ini persis di tabel strategi) ===
- Bias: ${tradingPlan.recommendedBias}
- Entry: Rp${scenario.entry.toFixed(0)}
- TP1: Rp${scenario.tp1.toFixed(0)} | TP2: Rp${scenario.tp2.toFixed(0)}
- SL: Rp${scenario.sl.toFixed(0)}
- Risk/Reward: ${scenario.riskRewardRatio.toFixed(2)}
- Catatan Sistem: ${scenario.notes}

Susun laporan riset saham ${summary.ticker} sesuai format yang telah ditentukan.`;
}

export function AnalisisReasearchReport(props: Props) {
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [markdown, setMarkdown] = useState('');
  const [error, setError] = useState('');

  const html = useMemo(() => {
    if (!markdown) return '';
    const raw = marked.parse(markdown, { async: false }) as string;
    return DOMPurify.sanitize(raw);
  }, [markdown]);

  async function generate() {
    setState('loading');
    setMarkdown('');
    setError('');

    try {
      const res = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'research', messages: [{ role: 'user', content: buildUserPrompt(props) }] }),
      });

      if (!res.ok || !res.body) {
        const data = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(data?.message || 'Terjadi kesalahan pada AI.');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fullText += decoder.decode(value, { stream: true });
        setMarkdown(fullText);
      }

      if (!fullText) throw new Error('Tidak ada respons dari AI. Coba lagi.');
      setState('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan. Coba lagi.');
      setState('error');
    }
  }

  return (
    <section className="neo-border neo-shadow overflow-hidden bg-white dark:bg-zinc-900 rounded-xl sm:rounded-none">
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b-[3px] border-(--neo-line)">
        <div className="flex items-center gap-3 min-w-0">
          <span className="flex size-9 shrink-0 items-center justify-center neo-border bg-violet-500 text-white text-sm">
            <FileText className="size-4" strokeWidth={2.5} />
          </span>
          <div className="min-w-0">
            <h2 className="font-bold uppercase tracking-wide text-zinc-800 dark:text-zinc-100">
              Analisis Research Report
            </h2>
            <p className="text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 truncate">
              Laporan riset AI: teknikal, fundamental & strategi trading
            </p>
          </div>
        </div>
        {state !== 'idle' && (
          <button
            type="button"
            onClick={generate}
            disabled={state === 'loading'}
            title="Buat ulang laporan"
            aria-label="Buat ulang laporan"
            className="neo-press flex size-8 shrink-0 items-center justify-center neo-border bg-white dark:bg-zinc-800 disabled:opacity-50"
          >
            <RefreshCw className={cn('size-3.5', state === 'loading' && 'animate-spin')} strokeWidth={2.5} />
          </button>
        )}
      </div>

      <div className="px-5 py-4">
        {state === 'idle' && (
          <div className="space-y-3">
            <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
              Minta AI menyusun laporan riset <strong>{props.summary.ticker}</strong> secara naratif — analisis
              teknikal, fundamental & katalis sentimen, hingga ringkasan strategi trading (entry, TP, SL).
            </p>
            <button
              type="button"
              onClick={generate}
              className="neo-press inline-flex items-center gap-2 neo-border neo-shadow-sm bg-violet-500 px-4 py-2 text-sm font-bold text-white"
            >
              <FileText className="size-4" strokeWidth={2.5} />
              Buat Laporan Riset AI
            </button>
          </div>
        )}

        {state === 'loading' && !markdown && (
          <div className="flex items-center gap-2 py-4 text-sm font-semibold text-zinc-400">
            <Loader2 className="size-4 animate-spin" strokeWidth={2.5} /> AI sedang menyusun laporan riset {props.summary.ticker}…
          </div>
        )}

        {state === 'error' && (
          <div className="flex items-start gap-2.5 neo-border bg-rose-50 dark:bg-rose-400/10 px-4 py-3">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-rose-500" strokeWidth={2.5} />
            <div className="space-y-2">
              <p className="text-sm text-rose-700 dark:text-rose-300">{error}</p>
              <button
                type="button"
                onClick={generate}
                className="neo-press inline-flex items-center gap-1.5 neo-border bg-white dark:bg-zinc-800 px-3 py-1.5 text-xs font-bold text-zinc-700 dark:text-zinc-200"
              >
                <RefreshCw className="size-3.5" strokeWidth={2.5} /> Coba Lagi
              </button>
            </div>
          </div>
        )}

        {html && (
          <div
            className="prose prose-zinc prose-sm max-w-none prose-headings:font-bold prose-headings:uppercase prose-headings:tracking-tight prose-table:text-sm prose-th:text-left dark:prose-invert"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        )}
      </div>
    </section>
  );
}
