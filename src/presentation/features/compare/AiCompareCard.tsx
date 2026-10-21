'use client';

/**
 * AiCompareCard.tsx
 *
 * On-demand AI peer comparison (docs/features_prompt_ai.md prompt 41) of the
 * two tickers on /compare: one metric table, the most efficient, the most
 * attractive valuation, and a pick per investor profile. The prompt is built
 * from the same summaries/fundamentals the page already shows.
 */

import { AlertTriangle, Loader2, RefreshCw, Sparkles } from 'lucide-react';
import { buildComparePrompt, CompareSide } from '@/domain/ai/promptBuilders';
import { useAiReport } from '@/presentation/features/ai/useAiReport';
import { Card } from '../screener/detail/components/ui';

export function AiCompareCard({ sides }: { sides: CompareSide[] }) {
  const { state, markdown, html, error, generate } = useAiReport();
  const tickers = sides.map((s) => s.summary.ticker).join(' vs ');
  const run = () => generate('compare', () => buildComparePrompt(sides));
  const btn = 'inline-flex h-9 items-center gap-2 rounded-lg border border-(--sv-border) bg-(--sv-surface) px-3 text-sm font-medium text-(--sv-text) hover:bg-(--sv-bg)';

  return (
    <Card>
      <div className="flex items-center gap-2 border-b border-(--sv-border) px-4 py-3 text-[15px] font-semibold text-(--sv-text)">
        <Sparkles className="size-4 text-violet-500" strokeWidth={2} /> Analisa AI: {tickers}
      </div>
      <div className="space-y-3 p-4">
        {state === 'idle' && (
          <>
            <p className="text-sm text-(--sv-muted)">
              Minta AI membandingkan pertumbuhan, margin, ROE, DER, PER, PBV, dan dividen kedua saham — siapa paling efisien, siapa
              valuasinya paling menarik, dan pilihan per profil investor.
            </p>
            <button type="button" onClick={run} className={btn}>
              <Sparkles className="size-4" strokeWidth={2} /> Bandingkan dengan AI
            </button>
          </>
        )}

        {state === 'loading' && !markdown && (
          <p className="flex items-center gap-2 text-sm text-(--sv-muted)">
            <Loader2 className="size-4 animate-spin" strokeWidth={2} /> AI sedang membandingkan {tickers}…
          </p>
        )}

        {state === 'error' && (
          <div className="flex items-start gap-2 text-sm text-rose-600 dark:text-rose-400">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" strokeWidth={2} />
            <span>{error}</span>
          </div>
        )}

        {html && (
          <div
            className="prose prose-slate prose-sm max-w-none overflow-x-auto prose-headings:text-(--sv-text) prose-table:text-sm prose-th:text-left dark:prose-invert"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        )}

        {(state === 'done' || state === 'error') && (
          <button type="button" onClick={run} className={btn}>
            <RefreshCw className="size-4" strokeWidth={2} /> {state === 'error' ? 'Coba Lagi' : 'Buat Ulang'}
          </button>
        )}
      </div>
    </Card>
  );
}
