'use client';

/**
 * RetailStrategyCard.tsx
 *
 * On-demand AI "Strategi Retail EOD" (docs/features_strategi_retail.md) over the first 10 stocks of the
 * screener list as currently filtered/sorted. Hard gates, status, SL/target, net R:R and position size are
 * computed by domain/analysis/retailStrategy.ts; the AI only writes the report. Broker summary & foreign flow
 * are opt-in because each stock costs Index Alpha quota.
 */

import { AlertTriangle, ChevronDown, Loader2, RefreshCw, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { buildRetailStrategyPrompt } from '@/domain/ai/promptBuilders';
import { evaluateRetailStrategy, rankRetailStrategy, RETAIL_STRATEGY_CONFIG, RetailStatus, RetailStrategyResult } from '@/domain/analysis/retailStrategy';
import { SmartMoneyFlows } from '@/domain/models/BrokerSummary';
import { getStockHistory, getStockSmartMoneyFlows } from '@/data/repositories/StockRepository';
import { mapWithConcurrency } from '@/lib/concurrency';
import { cn } from '@/lib/format';
import { useAiReport } from '@/presentation/features/ai/useAiReport';
import { Card } from '../detail/components/ui';
import { ScreenerResult } from './ResultsTable';

const STATUS_CLASS: Record<RetailStatus, string> = {
  LOLOS: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
  TUNGGU: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
  GUGUR: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400',
};

export function RetailStrategyCard({ rows }: { rows: ScreenerResult[] }) {
  const { state, markdown, html, error, generate } = useAiReport();
  const [open, setOpen] = useState(false);
  const [capital, setCapital] = useState(100_000_000);
  const [riskPct, setRiskPct] = useState(1);
  const [withFlows, setWithFlows] = useState(false);
  const [results, setResults] = useState<RetailStrategyResult[] | null>(null);
  const [step, setStep] = useState('');

  const picked = rows.slice(0, RETAIL_STRATEGY_CONFIG.maxStocks).map((r) => r.summary);
  const tickers = picked.map((s) => s.ticker).join(', ');
  const busy = state === 'loading';

  const run = () => generate('retail-strategy', async () => {
    const profile = { capital, riskPerTrade: riskPct / 100 };
    const now = new Date();
    setResults(null);
    setStep('Mengambil data harga EOD…');
    const inputs = await mapWithConcurrency(picked, 5, async (summary) => {
      const bars = await getStockHistory(summary.ticker, '1y').catch(() => []);
      return { summary, bars, flows: null as SmartMoneyFlows | null, now };
    });
    if (withFlows) {
      setStep('Mengambil broker summary & foreign flow…');
      // Sequential: Index Alpha rate-limits per minute.
      await mapWithConcurrency(inputs, 1, async (input) => {
        const res = await getStockSmartMoneyFlows(input.summary.ticker).catch(() => null);
        input.flows = res?.ok ? res.data : null;
      });
    }
    const ranked = rankRetailStrategy(inputs.map((i) => evaluateRetailStrategy(i, profile)));
    setResults(ranked);
    setStep('');
    return buildRetailStrategyPrompt({ results: ranked, profile, flowsRequested: withFlows });
  });

  const btn = 'inline-flex h-9 items-center gap-2 rounded-lg border border-(--sv-border) bg-(--sv-surface) px-3 text-sm font-medium text-(--sv-text) hover:bg-(--sv-bg) disabled:opacity-50';
  const input = 'h-9 w-full rounded-lg border border-(--sv-border) bg-(--sv-surface) px-2.5 text-sm tabular-nums text-(--sv-text)';

  return (
    <Card>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-4 py-3 text-left text-[15px] font-semibold text-(--sv-text)"
      >
        <Sparkles className="size-4 text-violet-500" strokeWidth={2} /> Strategi Retail EOD (AI)
        <span className="ml-1 hidden text-xs font-normal text-(--sv-muted) sm:inline">hard gate · entry/SL/target · ukuran posisi</span>
        <ChevronDown className={cn('ml-auto size-4 text-(--sv-muted) transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="space-y-3 border-t border-(--sv-border) p-4">
          <p className="text-sm text-(--sv-muted)">
            Menganalisis {picked.length ? <b className="text-(--sv-text)">{tickers}</b> : 'saham'} — {RETAIL_STRATEGY_CONFIG.maxStocks} saham teratas dari daftar
            yang sedang tampil (ikuti filter & urutan). Status LOLOS/TUNGGU/GUGUR dihitung sistem: likuiditas ≥ Rp1 M, trigger valid,
            SL ≤ 8% &amp; ≤ 2,5×ATR, upside ≥ 7%, net R:R ≥ 1:2, tanpa distribusi kuat, tidak extended.
          </p>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="space-y-1 text-xs font-medium text-(--sv-muted)">
              Modal (Rp)
              <input type="number" min={1_000_000} step={1_000_000} value={capital} onChange={(e) => setCapital(Number(e.target.value) || 0)} className={input} />
            </label>
            <label className="space-y-1 text-xs font-medium text-(--sv-muted)">
              Risiko per transaksi (%)
              <input type="number" min={0.1} max={5} step={0.1} value={riskPct} onChange={(e) => setRiskPct(Number(e.target.value) || 0)} className={input} />
            </label>
            <label className="flex items-center gap-2 self-end pb-2 text-sm text-(--sv-text)">
              <input type="checkbox" checked={withFlows} onChange={(e) => setWithFlows(e.target.checked)} className="size-4 accent-(--sv-primary)" />
              Sertakan broker & foreign flow
            </label>
          </div>
          {withFlows && (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              Broker summary & foreign flow memakai kuota Index Alpha (±4 request per saham). Tanpa data ini, gate distribusi tidak dapat
              dicek sehingga tidak ada saham yang bisa LOLOS.
            </p>
          )}

          <button type="button" onClick={run} disabled={busy || picked.length === 0 || capital <= 0 || riskPct <= 0} className={btn}>
            {state === 'idle' ? <Sparkles className="size-4" strokeWidth={2} /> : <RefreshCw className="size-4" strokeWidth={2} />}
            {state === 'idle' ? 'Jalankan Strategi Retail' : state === 'error' ? 'Coba Lagi' : 'Jalankan Ulang'}
          </button>

          {busy && !markdown && (
            <p className="flex items-center gap-2 text-sm text-(--sv-muted)">
              <Loader2 className="size-4 animate-spin" strokeWidth={2} /> {step || 'AI sedang menyusun laporan…'}
            </p>
          )}

          {results && (
            <ul className="flex flex-wrap gap-1.5" aria-label="Status hard gate per saham">
              {results.map((r) => (
                <li key={r.ticker} title={r.cancelReasons.join('\n') || 'Semua gate lolos'} className={cn('rounded-md px-2 py-1 text-xs font-semibold', STATUS_CLASS[r.status])}>
                  {r.ticker} · {r.status}
                </li>
              ))}
            </ul>
          )}

          {state === 'error' && (
            <div className="flex items-start gap-2 text-sm text-rose-600 dark:text-rose-400">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" strokeWidth={2} />
              <span>{error}</span>
            </div>
          )}

          {html && (
            <div
              className="prose prose-slate prose-sm max-w-none overflow-x-auto prose-headings:text-(--sv-text) prose-table:text-xs prose-th:text-left dark:prose-invert"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          )}
        </div>
      )}
    </Card>
  );
}
