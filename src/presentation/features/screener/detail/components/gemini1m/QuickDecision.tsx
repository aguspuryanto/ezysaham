'use client';

/**
 * Level 1 (10 detik) — ticker, decision, price / trend / condition, one-line reason, plan or a calmer
 * reference entry, risk, two-line conclusion and the Swing / Investing verdicts.
 * Level 2 ("Kenapa?") — plain-language reasons and the per-horizon detail.
 * No EMA / RVOL / VWAP / PER numbers here — those live in Level 3 (DetailAnalysis).
 */

import { ReactNode } from 'react';
import { DecisionV3Report, HorizonResult } from '@/domain/analysis/decisionEngineV3';
import { cn } from '@/lib/format';
import { fmtPct, fmtRp } from '../../format';
import { Badge } from '../ui';
import { Bullets, Callout, Caption, DECISION_EMOJI, DECISION_TONE, DecisionBadge, LevelBadge, TAG_TEXT } from './primitives';

const zone = (lo: number, hi: number) => (lo === hi ? fmtRp(lo) : `${fmtRp(lo)} – ${fmtRp(hi).replace('Rp ', '')}`);

function PlanTile({ icon, label, children, className }: { icon: string; label: string; children: ReactNode; className?: string }) {
  return (
    <div className="rounded-lg border border-(--sv-border) bg-(--sv-surface) p-3">
      <Caption>{icon} {label}</Caption>
      <div className={cn('mt-1 font-semibold tabular-nums text-(--sv-text)', className)}>{children}</div>
    </div>
  );
}

function Fact({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className="rounded-lg bg-(--sv-surface) px-3 py-2">
      <Caption>{label}</Caption>
      <p className={cn('mt-0.5 text-sm font-semibold tabular-nums text-(--sv-text)', className)}>{children}</p>
    </div>
  );
}

export function QuickDecision({ ticker, report }: { ticker: string; report: DecisionV3Report }) {
  const s = report.simple;
  const plan = s.plan;
  const tone = DECISION_TONE[s.status];
  const { swing, investing } = report.decisions;

  return (
    <div
      className={cn(
        'space-y-4 rounded-xl border-2 p-4',
        tone === 'positive' ? 'border-emerald-300/70 dark:border-emerald-400/30'
          : tone === 'negative' ? 'border-rose-300/70 dark:border-rose-400/30'
            : 'border-amber-300/70 dark:border-amber-400/30',
      )}
    >
      <div className="space-y-2">
        <p className="text-xl font-bold tracking-wide text-(--sv-text)">{ticker}</p>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={tone} className="px-3 py-1 text-base">
            {DECISION_EMOJI[s.status]} {s.status}{s.tag ? ` · ${TAG_TEXT[s.tag]}` : ''}
          </Badge>
          <span className="text-xs text-(--sv-muted)">Trading 1–5 hari</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Fact label="Harga">{fmtRp(s.price)}</Fact>
        <Fact
          label="Trend"
          className={s.trend === 'BULLISH' ? 'text-emerald-700 dark:text-emerald-400' : s.trend === 'BEARISH' ? 'text-rose-600 dark:text-rose-400' : undefined}
        >
          {s.trendLabel}
        </Fact>
        <Fact label="Kondisi" className={s.condition.startsWith('Overextended') ? 'text-amber-700 dark:text-amber-300' : undefined}>
          {s.condition}
        </Fact>
      </div>

      <div>
        <Caption>Alasan</Caption>
        <p className="mt-1 text-[15px] font-medium leading-relaxed text-(--sv-text)">{s.reason}</p>
      </div>

      {plan && (
        <div className="space-y-2">
          {plan.conditional && (
            <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
              Rencana bila sudah terkonfirmasi — belum sinyal beli.
            </p>
          )}
          <div className="grid gap-2 text-sm sm:grid-cols-2 xl:grid-cols-4">
            <PlanTile icon="📍" label="Entry" className="text-emerald-700 dark:text-emerald-400">{zone(plan.entryLow, plan.entryHigh)}</PlanTile>
            <PlanTile icon="🎯" label="Target">
              {plan.targets.map((t) => (
                <span key={t.label} className="block">
                  {t.label} {fmtRp(t.price)} <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">{fmtPct(t.gainPct, 1)}</span>
                </span>
              ))}
            </PlanTile>
            <PlanTile icon="🛑" label="Stop Loss" className="text-rose-600 dark:text-rose-400">
              {fmtRp(plan.sl)} <span className="text-xs font-medium">({fmtPct(-plan.riskPct, 1)})</span>
            </PlanTile>
            <PlanTile icon="📊" label="Risk / Reward">
              1 : {plan.riskReward.toLocaleString('id-ID', { maximumFractionDigits: 1, minimumFractionDigits: 1 })}
              <span className="block text-xs font-normal text-(--sv-muted)">{plan.rrText}</span>
            </PlanTile>
          </div>
        </div>
      )}

      {s.betterEntry ? (
        <Callout tone="warning">
          <Caption className="text-current opacity-80">🎯 Entry lebih menarik</Caption>
          <p className="mt-1 text-base font-semibold tabular-nums">± {fmtRp(s.betterEntry.price)}</p>
          <p className="mt-0.5">Syarat: {s.betterEntry.condition}</p>
        </Callout>
      ) : s.waitFor && (
        <Callout tone={s.status === 'AVOID' ? 'negative' : 'warning'}>
          <Caption className="text-current opacity-80">{s.status === 'AVOID' ? 'Baru menarik lagi bila' : '⏳ Tunggu'}</Caption>
          <p className="mt-1">{s.waitFor}</p>
        </Callout>
      )}

      <div className="flex flex-wrap items-center gap-1.5 text-sm">
        <span className="text-(--sv-muted)">⚠️ Risiko:</span>
        <LevelBadge level={s.risk}>{s.riskText}</LevelBadge>
      </div>

      <div className="border-t border-(--sv-border) pt-3 text-sm">
        <span className="text-(--sv-muted)">💡 Kesimpulan:</span>
        <p className="mt-1 text-(--sv-text)">{s.takeaway}</p>
        <p className="font-semibold text-(--sv-text)">{s.conclusion}</p>
      </div>

      <div className="grid gap-2 text-sm sm:grid-cols-2">
        {[swing, investing].map((d) => (
          <div key={d.horizon} className="flex items-center justify-between gap-2 rounded-lg bg-(--sv-surface) px-3 py-2">
            <span className="text-(--sv-muted)">{d.horizon === 'swing' ? 'Swing (5–15 hari)' : 'Investing'}</span>
            <DecisionBadge status={d.status} />
          </div>
        ))}
      </div>

      <p className="border-t border-(--sv-border) pt-3 text-xs text-(--sv-muted)">
        ⚠️ EOD + intraday tertunda · Edukasi, bukan ajakan jual/beli.
      </p>
    </div>
  );
}

function HorizonRow({ d }: { d: HorizonResult }) {
  return (
    <div className="space-y-1 rounded-lg bg-(--sv-surface) p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold text-(--sv-text)">{d.label}</span>
        <span className="flex items-center gap-1.5">
          {d.tag && <Badge tone={d.tag === 'AVOID CHASING' ? 'negative' : 'positive'}>{TAG_TEXT[d.tag]}</Badge>}
          <DecisionBadge status={d.status} />
        </span>
      </div>
      <p className="text-(--sv-text)">{d.reason}</p>
      {d.waitFor && <p className="text-xs text-(--sv-muted)">{d.status === 'AVOID' ? 'Baru menarik lagi bila: ' : 'Tunggu: '}{d.waitFor}</p>}
      {d.warnings.map((w) => <p key={w} className="text-xs text-amber-700 dark:text-amber-300">⚠️ {w}</p>)}
    </div>
  );
}

export function WhyPanel({ report }: { report: DecisionV3Report }) {
  const { decisions } = report;
  return (
    <details className="group rounded-xl border border-(--sv-border) bg-(--sv-bg)/40 p-4">
      <summary className="cursor-pointer text-sm font-semibold text-(--sv-text)">❓ Kenapa?</summary>
      <div className="mt-3 space-y-3">
        <Bullets items={report.simple.why} className="text-(--sv-text)" />
        <div className="grid gap-2 lg:grid-cols-3">
          <HorizonRow d={decisions.trading} />
          <HorizonRow d={decisions.swing} />
          <HorizonRow d={decisions.investing} />
        </div>
        <p className="text-xs text-(--sv-muted)">
          Trading: fundamental hanya peringatan · Swing: fundamental filter kedua · Investing: fundamental wajib sehat.
        </p>
      </div>
    </details>
  );
}
