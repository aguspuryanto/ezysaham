'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { StockSummary } from '@/domain/models/Stock';
import { cn, formatPercent } from '@/lib/format';

interface TickerPickerProps {
  label: string;
  value: string;
  /** Series colour of this side in the price chart. */
  color: string;
  onChange: (ticker: string) => void;
  summaries: StockSummary[];
  excludeTicker?: string;
}

export function TickerPicker({ label, value, color, onChange, summaries, excludeTicker }: TickerPickerProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = summaries.filter((s) => s.ticker !== excludeTicker);
    if (q) {
      list = list.filter(
        (s) => s.ticker.toLowerCase().includes(q) || s.name.toLowerCase().includes(q)
      );
    }
    return list.slice(0, 8);
  }, [query, summaries, excludeTicker]);

  return (
    <div ref={containerRef} className="relative">
      <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-(--sv-muted)">
        <span className="inline-block size-2.5 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
        {label}
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-(--sv-muted)" strokeWidth={2} />
        <input
          type="text"
          value={open ? query : value}
          onFocus={() => { setOpen(true); setQuery(''); }}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') { setOpen(false); setQuery(''); e.currentTarget.blur(); }
            if (e.key === 'Enter' && matches[0]) { onChange(matches[0].ticker); setOpen(false); setQuery(''); e.currentTarget.blur(); }
          }}
          placeholder="Cari kode atau nama emiten…"
          className="h-10 w-full rounded-lg border border-(--sv-border) bg-(--sv-surface) pl-9 pr-3 text-sm font-semibold uppercase text-(--sv-text) outline-none placeholder:font-normal placeholder:normal-case placeholder:text-(--sv-muted) focus:border-(--sv-primary) focus:ring-2 focus:ring-(--sv-primary)/15"
        />
      </div>

      {open && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1.5 max-h-80 overflow-y-auto rounded-xl border border-(--sv-border) bg-(--sv-surface) py-1 shadow-lg">
          {matches.length === 0 ? (
            <p className="px-3 py-4 text-center text-sm text-(--sv-muted)">Tidak ditemukan.</p>
          ) : (
            matches.map((s) => (
              <button
                key={s.ticker}
                type="button"
                onClick={() => {
                  onChange(s.ticker);
                  setOpen(false);
                  setQuery('');
                }}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-(--sv-bg)"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-(--sv-primary-soft) text-[11px] font-bold text-(--sv-primary)">
                  {s.ticker.slice(0, 2)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-(--sv-text)">{s.ticker}</span>
                  <span className="block truncate text-xs text-(--sv-muted)">{s.name}</span>
                </span>
                <span
                  className={cn(
                    'shrink-0 text-xs font-semibold tabular-nums',
                    s.percentChange1D >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                  )}
                >
                  {formatPercent(s.percentChange1D)}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
