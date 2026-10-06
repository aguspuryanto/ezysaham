'use client';

/**
 * "📊 Core Technical" — the mandatory order (Fase → Trend → Tenaga → Momentum → Posisi Harga → Entry →
 * Risiko → Keputusan). Each step shows its value, the one reading behind it (→) and a plain sentence.
 * Keputusan is the Decision Engine v3 verdict (see technicalAnalysisV3.ts).
 */

import { ReactNode } from 'react';
import { TaStep, TechnicalAnalysisV3, trendTone } from '@/domain/analysis/technicalAnalysisV3';
import { cn } from '@/lib/format';
import { Badge } from '../ui';

const FINAL_EMOJI = { BUY: '🟢', WAIT: '🟡', AVOID: '🔴', 'AVOID CHASING': '🔴' } as const;

function StepRow({ no, title, step, value }: { no: string; title: string; step: TaStep<string>; value?: ReactNode }) {
  return (
    <li className="flex gap-3 py-3">
      <span className="w-6 shrink-0 text-center text-base leading-6">{no}</span>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-semibold text-(--sv-text)">{title}</span>
          {value ?? <Badge tone={step.tone}>{step.value}</Badge>}
        </div>
        <p className="text-xs font-medium tabular-nums text-(--sv-muted)">→ {step.detail}</p>
        <p className="text-sm text-(--sv-text)">{step.explain}</p>
      </div>
    </li>
  );
}

export function TechnicalAnalysisPanel({ ta }: { ta: TechnicalAnalysisV3 }) {
  const d = ta.decision;
  const t = ta.trend;
  return (
    <section className="rounded-xl border border-(--sv-border) bg-(--sv-bg)/40 p-4">
      <h3 className="text-sm font-semibold text-(--sv-text)">📊 Core Technical</h3>
      <ol className="mt-1 divide-y divide-(--sv-border)/70">
        <StepRow no="1️⃣" title="Fase" step={{ ...ta.phase, detail: `Struktur: ${ta.phase.detail}` }} />
        <StepRow
          no="2️⃣"
          title="Trend"
          step={{ ...t, detail: 'Harga + EMA + struktur: Pendek = EMA 9/21 · Menengah = EMA 50 · Panjang = EMA 200' }}
          value={(
            <span className="flex flex-wrap gap-1">
              <Badge tone={trendTone(t.short)}>Pendek {t.short}</Badge>
              <Badge tone={trendTone(t.medium)}>Menengah {t.medium}</Badge>
              <Badge tone={trendTone(t.long)}>Panjang {t.long}</Badge>
            </span>
          )}
        />
        <StepRow no="3️⃣" title="Tenaga" step={ta.power} />
        <StepRow no="4️⃣" title="Momentum" step={ta.momentum} />
        <StepRow no="5️⃣" title="Posisi Harga" step={ta.position} />
        <StepRow no="6️⃣" title="Entry" step={ta.entry} />
        <StepRow no="7️⃣" title="Risiko" step={ta.risk} />
      </ol>
      {ta.risk.flags.length > 0 && (
        <div className="mb-3 ml-9 flex flex-wrap gap-1.5">
          {ta.risk.flags.map((f) => <Badge key={f.key} tone="negative">⚠️ {f.key}</Badge>)}
        </div>
      )}

      <div
        className={cn(
          'rounded-lg border p-3',
          d.tone === 'positive' ? 'border-emerald-200 bg-emerald-50/60 dark:border-emerald-400/25 dark:bg-emerald-400/5'
            : d.tone === 'warning' ? 'border-amber-200 bg-amber-50/60 dark:border-amber-400/25 dark:bg-amber-400/5'
              : 'border-rose-200 bg-rose-50/60 dark:border-rose-400/25 dark:bg-rose-400/5',
        )}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-(--sv-text)">🎯 Keputusan</span>
          <Badge tone={d.tone} className="px-3 py-1 text-sm">{FINAL_EMOJI[d.value]} {d.value}</Badge>
        </div>
        <p className="mt-2 text-sm text-(--sv-text)">{d.explain}</p>
        {d.conflicts.length > 0 && (
          <div className="mt-2 text-xs text-amber-800 dark:text-amber-200">
            <span className="font-semibold">⚖️ Konflik data:</span>
            <ul className="mt-0.5 space-y-0.5">{d.conflicts.map((c) => <li key={c}>• {c}</li>)}</ul>
          </div>
        )}
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-(--sv-muted)">
          {d.checks.map((c) => <li key={c.label}>{c.ok ? '✅' : '⏳'} {c.label}</li>)}
        </ul>
        <p className="mt-3 border-t border-(--sv-border)/70 pt-2 text-xs text-(--sv-text)">
          Sahamnya: <b>{ta.stockVsTiming.stock}</b> · Waktu beli: <b>{ta.stockVsTiming.timing}</b>
          <span className="block text-(--sv-muted)">{ta.stockVsTiming.note}</span>
        </p>
      </div>

      <p className="mt-3 text-[11px] text-(--sv-muted)">
        EMA = garis harga rata-rata · Support = &ldquo;lantai&rdquo; · Resistance = &ldquo;atap&rdquo; ·
        RSI &amp; MACD = pengukur tenaga · R:R = perbandingan untung vs rugi.
      </p>
    </section>
  );
}
