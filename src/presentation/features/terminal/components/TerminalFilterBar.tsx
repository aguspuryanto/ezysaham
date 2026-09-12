'use client';

import { cn } from '@/lib/format';
import { SortKey } from '../TerminalPage';

export type MarketCapBucket = 'all' | 'big' | 'mid' | 'small';
export type AiSignalTier = 'all' | 'strong' | 'moderate' | 'weak';

const SORT_OPTIONS: Array<{ value: SortKey; label: string }> = [
  { value: 'change_desc', label: 'Perubahan % (Tertinggi)' },
  { value: 'change_asc', label: 'Perubahan % (Terendah)' },
  { value: 'value_desc', label: 'Nilai Transaksi (Tertinggi)' },
  { value: 'ticker_asc', label: 'Ticker (A-Z)' },
];

const MARKET_CAP_OPTIONS: Array<{ value: MarketCapBucket; label: string }> = [
  { value: 'all', label: 'Market Cap: Semua' },
  { value: 'big', label: 'Big Cap (>Rp10T)' },
  { value: 'mid', label: 'Mid Cap (Rp1T-10T)' },
  { value: 'small', label: 'Small Cap (<Rp1T)' },
];

const AI_SIGNAL_OPTIONS: Array<{ value: AiSignalTier; label: string }> = [
  { value: 'all', label: 'AI Signal: Semua' },
  { value: 'strong', label: 'Strong (≥65)' },
  { value: 'moderate', label: 'Moderate (50-64)' },
  { value: 'weak', label: 'Weak (<50)' },
];

function Select<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: Array<{ value: T; label: string }> }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className="rounded border border-(--term-border) bg-(--term-surface) px-2.5 py-1.5 text-xs font-semibold text-(--term-text) outline-none"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

export function TerminalFilterBar({
  sortKey,
  onSortChange,
  marketCap,
  onMarketCapChange,
  aiSignal,
  onAiSignalChange,
  autoRefresh,
  onAutoRefreshChange,
}: {
  sortKey: SortKey;
  onSortChange: (v: SortKey) => void;
  marketCap: MarketCapBucket;
  onMarketCapChange: (v: MarketCapBucket) => void;
  aiSignal: AiSignalTier;
  onAiSignalChange: (v: AiSignalTier) => void;
  autoRefresh: boolean;
  onAutoRefreshChange: (v: boolean) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="font-terminal-mono text-[10px] font-bold text-(--term-muted)">SORT:</span>
      <Select value={sortKey} onChange={onSortChange} options={SORT_OPTIONS} />
      <Select value={marketCap} onChange={onMarketCapChange} options={MARKET_CAP_OPTIONS} />
      <Select value={aiSignal} onChange={onAiSignalChange} options={AI_SIGNAL_OPTIONS} />

      <button
        type="button"
        onClick={() => onAutoRefreshChange(!autoRefresh)}
        className={cn('ml-auto flex items-center gap-1.5 font-terminal-mono text-[11px] font-bold', autoRefresh ? 'text-(--term-emerald)' : 'text-(--term-muted)')}
      >
        <span className={cn('size-1.5 rounded-full', autoRefresh ? 'bg-(--term-emerald)' : 'bg-(--term-border-strong)')} />
        AUTO REFRESH: {autoRefresh ? '10s LIVE' : 'OFF'}
      </button>
    </div>
  );
}
