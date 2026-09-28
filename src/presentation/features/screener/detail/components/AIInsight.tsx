import { AlertTriangle, CheckCircle2, Sparkles, XCircle } from 'lucide-react';
import { cn } from '@/lib/format';
import { AIInsightData, InsightSignal } from '../useStockDetail';
import { Badge, TONE_TEXT } from './ui';

const SIGNAL_ICON: Record<InsightSignal['tone'], typeof CheckCircle2> = {
  positive: CheckCircle2,
  warning: AlertTriangle,
  negative: XCircle,
};

/** Rule-based analytical summary — describes current conditions, never a price promise. */
export function AIInsight({ analysis }: { analysis: AIInsightData }) {
  const cautions = analysis.signals.filter((s) => s.text.startsWith('Waspada'));
  const signals = analysis.signals.filter((s) => !s.text.startsWith('Waspada'));
  return (
    <section
      aria-labelledby="ai-insight-title"
      className="grid gap-4 rounded-xl border border-(--sv-primary)/20 bg-(--sv-primary-soft)/60 p-4 sm:p-5 md:grid-cols-[1fr_minmax(0,16rem)]"
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-(--sv-primary) text-(--sv-primary-fg)">
            <Sparkles className="size-4" strokeWidth={2} />
          </span>
          <h2 id="ai-insight-title" className="text-base font-semibold text-(--sv-text)">AI Insight</h2>
          <Badge tone="info">Analisa Berbasis Data &amp; Indikator</Badge>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-(--sv-text)">{analysis.summary}</p>
        <p className="mt-2 text-[11px] text-(--sv-muted)">Bukan rekomendasi beli/jual. Selalu kelola risiko sesuai rencana Anda.</p>
      </div>

      <div className="border-(--sv-border) md:border-l md:pl-4">
        <h3 className="text-sm font-semibold text-(--sv-primary)">Sinyal Utama</h3>
        <ul className="mt-2 space-y-1.5 text-sm">
          {[...signals, ...cautions].map((s) => {
            const Icon = SIGNAL_ICON[s.tone];
            return (
              <li key={s.text} className={cn('flex items-start gap-2', s.tone === 'negative' && cautions.includes(s) ? 'font-medium' : '')}>
                <Icon className={cn('mt-0.5 size-4 shrink-0', TONE_TEXT[s.tone])} strokeWidth={2} />
                <span className={cautions.includes(s) ? TONE_TEXT.negative : 'text-(--sv-text)'}>{s.text}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
