'use client';

import { ArrowUpRight, Lightbulb, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect } from 'react';
import { StockSignal } from '@/domain/models/Signal';
import { cn } from '@/lib/format';
import { fmtDateLong } from '../signalUi';
import { SaraScore } from './SignalBadge';
import { DecisionBlock, RiskList, SignalHeading, WhyList } from './SignalCard';
import { ScoreBreakdown } from './ScoreBreakdown';
import { TradePlan } from './TradePlan';

function Section({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn('border-t border-(--sv-border) px-5 py-4', className)}>
      <h3 className="mb-2.5 text-[11px] font-semibold uppercase tracking-wide text-(--sv-muted)">{title}</h3>
      {children}
    </section>
  );
}

export function SignalDetailDrawer({ signal, onClose }: { signal: StockSignal | null; onClose: () => void }) {
  const open = signal != null;

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  return (
    <>
      <div
        className={cn('fixed inset-0 z-50 bg-slate-900/40 transition-opacity', open ? 'opacity-100' : 'pointer-events-none opacity-0')}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={signal ? `Detail sinyal ${signal.ticker}` : 'Detail sinyal'}
        className={cn(
          'fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-(--sv-surface) shadow-xl transition-transform duration-300 ease-out',
          open ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        {signal && (
          <>
            <div className="flex items-center justify-between gap-2 px-5 py-3">
              <span className="text-xs text-(--sv-muted)">Sinyal {fmtDateLong(signal.date)}</span>
              <button
                type="button"
                onClick={onClose}
                aria-label="Tutup detail"
                className="flex size-8 items-center justify-center rounded-lg border border-(--sv-border) text-(--sv-text) hover:bg-(--sv-bg)"
              >
                <X className="size-4" strokeWidth={2} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto [scrollbar-width:thin]">
              <div className="space-y-4 px-5 pb-4">
                <SignalHeading signal={signal} />
                <div className="grid grid-cols-2 gap-4 rounded-xl bg-(--sv-bg) p-3">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-(--sv-muted)">SARA Score</div>
                    <div className="mt-1"><SaraScore score={signal.saraScore} size="lg" /></div>
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-(--sv-muted)">Confidence</div>
                    <div className="mt-1 text-3xl font-bold tabular-nums text-(--sv-text)">{signal.confidence}%</div>
                    <div className="text-xs text-(--sv-muted)">{signal.pattern} · {signal.sector}</div>
                  </div>
                </div>
                <DecisionBlock signal={signal} />
              </div>

              <Section title="Why this signal?">
                <div className="flex gap-2.5 rounded-lg bg-(--sv-primary-soft) p-3 text-sm leading-relaxed text-(--sv-text)">
                  <Lightbulb className="mt-0.5 size-4 shrink-0 text-(--sv-primary)" strokeWidth={2} />
                  <p>{signal.explanation}</p>
                </div>
              </Section>

              <Section title="Trade Plan"><TradePlan plan={signal.tradePlan} /></Section>

              <Section title="Why"><WhyList reasons={signal.reasons} /></Section>

              <Section title="Risk"><RiskList risks={signal.risks} /></Section>

              <Section title="Score Breakdown"><ScoreBreakdown factors={signal.scoreBreakdown} /></Section>

              <Section title="Catatan">
                <p className="text-xs leading-relaxed text-(--sv-muted)">
                  Sinyal SARA AI adalah alat bantu keputusan berbasis algoritma dari data EOD, bukan nasihat keuangan dan tidak
                  menjamin profit. Selalu gunakan stop loss dan sesuaikan ukuran posisi dengan profil risiko Anda.
                </p>
              </Section>
            </div>

            <div className="border-t border-(--sv-border) p-4">
              <Link
                href={`/screener/${signal.ticker}`}
                className="flex items-center justify-center gap-1.5 rounded-lg bg-(--sv-primary) py-2.5 text-sm font-semibold text-(--sv-primary-fg)"
              >
                Analisa lengkap {signal.ticker} <ArrowUpRight className="size-4" strokeWidth={2} />
              </Link>
            </div>
          </>
        )}
      </aside>
    </>
  );
}
