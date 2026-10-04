'use client';

/**
 * CompareBar.tsx
 *
 * "Bandingkan" selection (max 2 tickers) shared by the stock tables, plus the floating bar that
 * links to /compare once two are picked.
 */

import { GitCompare, X } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useState } from 'react';

export function useCompareSelection() {
  const [selection, setSelection] = useState<string[]>([]);

  const toggle = useCallback((ticker: string) => {
    setSelection((prev) => {
      if (prev.includes(ticker)) return prev.filter((t) => t !== ticker);
      if (prev.length >= 2) return [prev[1], ticker]; // drop the oldest, keep the newest 2
      return [...prev, ticker];
    });
  }, []);
  const isSelected = useCallback((ticker: string) => selection.includes(ticker), [selection]);
  const clear = useCallback(() => setSelection([]), []);

  return { selection, toggle, isSelected, clear };
}

export function CompareBar({ selection, onClear }: { selection: string[]; onClear: () => void }) {
  if (selection.length === 0) return null;
  return (
    <div className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
      <div className="flex items-center gap-3 rounded-xl border border-(--sv-border) bg-(--sv-surface) px-4 py-2.5 shadow-lg">
        <GitCompare className="size-4 shrink-0 text-(--sv-primary)" strokeWidth={2} />
        <span className="text-sm font-medium text-(--sv-text)">
          {selection.length === 2 ? `${selection[0]} vs ${selection[1]}` : `${selection[0]} dipilih — pilih 1 saham lagi`}
        </span>
        {selection.length === 2 && (
          <Link
            href={`/compare?a=${selection[0]}&b=${selection[1]}`}
            className="rounded-lg bg-(--sv-primary) px-3 py-1.5 text-sm font-semibold text-(--sv-primary-fg)"
          >
            Bandingkan →
          </Link>
        )}
        <button
          type="button"
          onClick={onClear}
          aria-label="Batalkan pilihan bandingkan"
          className="flex size-7 shrink-0 items-center justify-center rounded-md text-(--sv-muted) hover:text-rose-500"
        >
          <X className="size-4" strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
