'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { StockSummary } from '@/domain/models/Stock';
import { cn, formatPercent } from '@/lib/format';

const AVATAR_TONES = [
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300',
  'bg-blue-100 text-blue-700 dark:bg-blue-400/10 dark:text-blue-300',
  'bg-amber-100 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300',
  'bg-violet-100 text-violet-700 dark:bg-violet-400/10 dark:text-violet-300',
  'bg-rose-100 text-rose-700 dark:bg-rose-400/10 dark:text-rose-300',
  'bg-cyan-100 text-cyan-700 dark:bg-cyan-400/10 dark:text-cyan-300',
];

function avatarTone(ticker: string): string {
  const sum = [...ticker].reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return AVATAR_TONES[sum % AVATAR_TONES.length];
}

interface TickerPickerProps {
  label: string;
  value: string;
  onChange: (ticker: string) => void;
  summaries: StockSummary[];
  excludeTicker?: string;
}

export function TickerPicker({ label, value, onChange, summaries, excludeTicker }: TickerPickerProps) {
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
      <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
        {label}
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" strokeWidth={2.5} />
        <input
          type="text"
          value={open ? query : value}
          onFocus={() => { setOpen(true); setQuery(''); }}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cari ticker atau nama..."
          className="w-full neo-border bg-white py-2.5 pl-9 pr-3 text-sm font-bold uppercase text-zinc-900 outline-none transition-shadow placeholder:font-normal placeholder:normal-case placeholder:text-zinc-400 focus:shadow-(--neo-shadow-sm) dark:bg-zinc-900 dark:text-zinc-100"
        />
      </div>

      {open && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1.5 max-h-80 overflow-y-auto neo-border neo-shadow-sm bg-white dark:bg-zinc-900">
          {matches.length === 0 ? (
            <p className="px-3 py-4 text-center text-sm font-semibold text-zinc-400">Tidak ditemukan.</p>
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
                className="flex w-full items-center gap-2.5 border-b-2 border-(--neo-line) px-3 py-2 text-left last:border-b-0 hover:bg-zinc-50 dark:hover:bg-zinc-800"
              >
                <span className={cn('flex size-7 shrink-0 items-center justify-center border-2 border-(--neo-line) text-[10px] font-bold tracking-tight', avatarTone(s.ticker))}>
                  {s.ticker.slice(0, 2)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-zinc-900 dark:text-zinc-100">{s.ticker}</span>
                  <span className="block truncate text-xs text-zinc-500 dark:text-zinc-400">{s.name}</span>
                </span>
                <span
                  className={cn(
                    'shrink-0 font-mono text-xs font-bold tabular-nums',
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
