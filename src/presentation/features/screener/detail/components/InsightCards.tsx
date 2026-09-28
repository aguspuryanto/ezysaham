'use client';

/**
 * Right-panel insight cards (features_redesign_detail.md §3): Snapshot, Key Levels,
 * Fundamental, Ownership/Flow, Performance and Price vs Target. Each takes plain
 * data props so it renders any emiten, and shows "—" rather than 0 for gaps.
 */

import { Building2, Crosshair, LineChart, Target, Timer, Users } from 'lucide-react';
import { cn } from '@/lib/format';
import { InfoTip } from '../../components/Popover';
import { fmtMultiple, fmtPct, fmtPctPlain, fmtRp, fmtRpCompactSigned, toneOf } from '../format';
import { FlowData, FundamentalData, KeyLevel, PerformanceItem, SnapshotData } from '../useStockDetail';
import { Badge, Card, EmptyNote, KeyValueRow, PanelTitle, Skeleton, TONE_TEXT } from './ui';

export function SnapshotCard({ snapshot }: { snapshot: SnapshotData }) {
  const fair = snapshot.fairLow != null && snapshot.fairHigh != null
    ? snapshot.fairLow === snapshot.fairHigh ? fmtRp(snapshot.fairLow) : `${fmtRp(snapshot.fairLow)} – ${fmtNumOnly(snapshot.fairHigh)}`
    : '—';
  return (
    <Card aria-labelledby="snapshot-title">
      <PanelTitle icon={Timer} id="snapshot-title">Snapshot</PanelTitle>
      <div className="divide-y divide-(--sv-border)">
        <KeyValueRow label="Market Phase">
          {snapshot.marketPhase ? <Badge tone={snapshot.marketPhase.tone}>{snapshot.marketPhase.label}</Badge> : '—'}
        </KeyValueRow>
        <KeyValueRow label={<span className="flex items-center gap-1">Fair Value <InfoTip term="Fair Value" text="Rentang nilai wajar dari beberapa metode valuasi (PER, PBV, dll.). Estimasi, bukan target harga pasti." /></span>}>
          {fair}
        </KeyValueRow>
        <KeyValueRow label="Upside Potensial">
          <span className={TONE_TEXT[toneOf(snapshot.upsidePct)]}>{fmtPct(snapshot.upsidePct)}</span>
        </KeyValueRow>
        <KeyValueRow label="Status">
          {snapshot.valuationStatus ? <Badge tone={snapshot.valuationStatus.tone}>{snapshot.valuationStatus.label}</Badge> : '—'}
        </KeyValueRow>
        <KeyValueRow label="Risk">
          {snapshot.risk ? <Badge tone={snapshot.risk.tone}>{snapshot.risk.label}</Badge> : '—'}
        </KeyValueRow>
      </div>
    </Card>
  );
}

function fmtNumOnly(n: number) {
  return fmtRp(n).replace('Rp ', '');
}

export function KeyLevelsCard({ levels, price }: { levels: KeyLevel[]; price: number }) {
  return (
    <Card aria-labelledby="levels-title">
      <PanelTitle icon={Crosshair} id="levels-title">Key Levels</PanelTitle>
      {levels.length === 0 ? (
        <EmptyNote>Level support/resistance belum dapat dihitung.</EmptyNote>
      ) : (
        <ul className="divide-y divide-(--sv-border)">
          {levels.map((l) => {
            const dist = ((l.price - price) / price) * 100;
            return (
              <li key={l.label} className="flex items-center justify-between gap-3 px-4 py-2.5" title={l.description}>
                <span className={cn('text-sm font-semibold', TONE_TEXT[l.tone])}>{l.label}</span>
                <span className="text-right">
                  <span className={cn('block text-sm font-bold tabular-nums', TONE_TEXT[l.tone])}>{fmtRp(l.price)}</span>
                  <span className="block text-[11px] tabular-nums text-(--sv-muted)">{fmtPct(dist)} dari harga</span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

export function FundamentalCard({ fundamental, loading }: { fundamental: FundamentalData; loading?: boolean }) {
  const items: Array<{ label: string; value: string; tone?: ReturnType<typeof toneOf>; tip: string }> = [
    { label: 'ROE', value: fmtPctPlain(fundamental.roe), tip: 'Return on Equity: laba bersih ÷ ekuitas. Makin tinggi makin efisien.' },
    { label: 'PER', value: fmtMultiple(fundamental.per), tip: 'Price to Earnings Ratio: harga ÷ laba per saham.' },
    { label: 'PBV', value: fmtMultiple(fundamental.pbv), tip: 'Price to Book Value: harga ÷ nilai buku per saham.' },
    { label: 'DER', value: fmtMultiple(fundamental.der), tip: 'Debt to Equity Ratio. Untuk bank, DER tinggi wajar karena dana pihak ketiga.' },
    { label: 'Revenue Growth', value: fmtPct(fundamental.revenueGrowth, 1), tone: toneOf(fundamental.revenueGrowth), tip: 'Pertumbuhan pendapatan YoY (kuartal terakhir).' },
    { label: 'Net Profit Growth', value: fmtPct(fundamental.netProfitGrowth, 1), tone: toneOf(fundamental.netProfitGrowth), tip: 'Pertumbuhan laba YoY (kuartal terakhir).' },
  ];
  return (
    <Card aria-labelledby="fund-title">
      <PanelTitle icon={Building2} id="fund-title">Fundamental</PanelTitle>
      <dl className="grid grid-cols-3 gap-x-3 gap-y-4 p-4">
        {items.map((it) => (
          <div key={it.label} className="min-w-0" title={it.tip}>
            <dt className="truncate text-[11px] text-(--sv-muted)">{it.label}</dt>
            <dd className={cn('mt-0.5 text-base font-bold tabular-nums', it.tone ? TONE_TEXT[it.tone] : 'text-(--sv-text)')}>
              {loading && it.value === '—' ? <Skeleton className="h-5 w-12" /> : it.value}
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

export function OwnershipFlowCard({ flow, loading }: { flow: FlowData; loading?: boolean }) {
  const foreignTone = toneOf(flow.netForeign);
  return (
    <Card aria-labelledby="flow-title">
      <PanelTitle icon={Users} id="flow-title">Ownership / Flow</PanelTitle>
      <div className="divide-y divide-(--sv-border)">
        <KeyValueRow label="Foreign Flow (Net)">
          {loading ? <Skeleton className="h-4 w-16" /> : <span className={TONE_TEXT[foreignTone]}>{fmtRpCompactSigned(flow.netForeign)}</span>}
        </KeyValueRow>
        <KeyValueRow label="Broker Activity">
          {loading ? <Skeleton className="h-4 w-16" /> : flow.brokerActivity ? <span className={TONE_TEXT[flow.brokerActivity.tone]}>{flow.brokerActivity.label}</span> : '—'}
        </KeyValueRow>
        <KeyValueRow label="Foreign Flow">
          {loading ? <Skeleton className="h-4 w-16" /> : flow.netForeign == null ? '—' : (
            <span className={TONE_TEXT[foreignTone]}>{flow.netForeign > 0 ? 'Positif' : flow.netForeign < 0 ? 'Negatif' : 'Netral'}</span>
          )}
        </KeyValueRow>
        {flow.bandarEstimate && (
          <KeyValueRow label={<span className="flex items-center gap-1">Estimasi Bandar <InfoTip term="Estimasi Bandar" text="Skor proxy (Wyckoff) dari pola harga & volume EOD — bukan data broker asli." /></span>}>
            <span className={TONE_TEXT[flow.bandarEstimate.tone]}>{flow.bandarEstimate.label}</span>
          </KeyValueRow>
        )}
      </div>
      {!loading && !flow.hasRealBrokerData && (
        <p className="border-t border-(--sv-border) px-4 py-2 text-[11px] text-(--sv-muted)">Data broker &amp; foreign flow belum tersedia saat ini.</p>
      )}
    </Card>
  );
}

export function PerformanceCard({ items }: { items: PerformanceItem[] }) {
  return (
    <Card aria-labelledby="perf-title">
      <PanelTitle icon={LineChart} id="perf-title">Performa Harga</PanelTitle>
      <dl className="grid grid-cols-5 divide-x divide-(--sv-border) py-3">
        {items.map((it) => (
          <div key={it.label} className="min-w-0 px-1 text-center">
            <dt className="text-[11px] text-(--sv-muted)">{it.label}</dt>
            <dd className={cn('mt-0.5 truncate text-xs font-bold tabular-nums sm:text-sm', TONE_TEXT[toneOf(it.value)])}>{fmtPct(it.value)}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

export function PriceTargetCard({ price, fairLow, fairHigh, upsidePct }: { price: number; fairLow: number | null; fairHigh: number | null; upsidePct: number | null }) {
  if (fairLow == null || fairHigh == null) {
    return (
      <Card aria-labelledby="target-title">
        <PanelTitle icon={Target} id="target-title">Harga vs Target</PanelTitle>
        <EmptyNote>Nilai wajar belum dapat dihitung untuk emiten ini.</EmptyNote>
      </Card>
    );
  }
  const min = Math.min(price, fairLow) * 0.92;
  const max = Math.max(price, fairHigh) * 1.05;
  const pos = (v: number) => `${((v - min) / (max - min)) * 100}%`;
  const below = price < fairLow;
  return (
    <Card aria-labelledby="target-title">
      <PanelTitle icon={Target} id="target-title">Harga vs Target</PanelTitle>
      <div className="px-4 pb-4 pt-5">
        <div className="relative h-2 rounded-full bg-slate-200 dark:bg-slate-700" role="img" aria-label={`Harga ${fmtRp(price)}, nilai wajar ${fmtRp(fairLow)} sampai ${fmtRp(fairHigh)}`}>
          <div className="absolute inset-y-0 rounded-full bg-emerald-500/80" style={{ left: pos(fairLow), width: `calc(${pos(fairHigh)} - ${pos(fairLow)})` }} />
          <div className="absolute -top-1 h-4 w-1 -translate-x-1/2 rounded-full bg-(--sv-primary) ring-2 ring-(--sv-surface)" style={{ left: pos(price) }} />
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
          <div>
            <p className="font-bold tabular-nums text-(--sv-text)">{fmtRp(price)}</p>
            <p className="text-(--sv-muted)">Harga Saat Ini</p>
          </div>
          <div className="text-center">
            <p className="font-bold tabular-nums text-(--sv-text)">{fmtNumOnly(fairLow)} – {fmtNumOnly(fairHigh)}</p>
            <p className="text-(--sv-muted)">Fair Value</p>
          </div>
          <div className="text-right">
            <p className={cn('font-bold tabular-nums', TONE_TEXT[toneOf(upsidePct)])}>{fmtPct(upsidePct)}</p>
            <p className="text-(--sv-muted)">{(upsidePct ?? 0) >= 0 ? 'Upside' : 'Downside'}</p>
          </div>
        </div>
        <p className="mt-3 text-[11px] text-(--sv-muted)">
          {below ? 'Harga di bawah rentang nilai wajar.' : price > fairHigh ? 'Harga di atas rentang nilai wajar.' : 'Harga berada di dalam rentang nilai wajar.'}
        </p>
      </div>
    </Card>
  );
}

export function InsightPanelSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      {[200, 150, 170, 150].map((h, i) => (
        <Card key={i} className="p-4">
          <Skeleton className="mb-4 h-5 w-28" />
          <div style={{ height: h - 60 }} className="animate-pulse rounded-md bg-slate-100 dark:bg-slate-800" />
        </Card>
      ))}
    </div>
  );
}
