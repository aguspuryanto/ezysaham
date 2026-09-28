'use client';

import { Menu, Search, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { SITE_NAME } from '@/lib/site';
import { cn } from '@/lib/format';
import { AuthButton } from '@/presentation/features/auth/AuthButton';
import { isIdxOpen } from './IhsgChart';
import { MarketSeriesSnapshot } from './MarketSummary';

const idNum = (n: number, dec = 2) => n.toLocaleString('id-ID', { minimumFractionDigits: dec, maximumFractionDigits: dec });

function useIdxOpen() {
  const [open, setOpen] = useState<boolean | null>(null);
  useEffect(() => {
    const tick = () => setOpen(isIdxOpen(new Date()));
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 60_000);
    return () => { clearTimeout(first); clearInterval(id); };
  }, []);
  return open;
}

export function ScreenerHeader({
  query,
  onQueryChange,
  lastUpdatedAt,
  ihsg,
  onOpenDrawer,
  onSubmitQuery,
}: {
  query: string;
  onQueryChange: (q: string) => void;
  lastUpdatedAt: Date | null;
  ihsg: MarketSeriesSnapshot | null;
  onOpenDrawer: () => void;
  /** Optional Enter handler (e.g. the detail page jumps to the typed ticker). */
  onSubmitQuery?: (q: string) => void;
}) {
  const marketOpen = useIdxOpen();
  const up = ihsg != null && ihsg.change >= 0;

  return (
    <header className="sticky top-0 z-30 border-b border-(--sv-border) bg-(--sv-surface)/95 backdrop-blur">
      <div className="flex h-16 items-center gap-3 px-4 sm:gap-5 sm:px-6">
        <button
          type="button"
          onClick={onOpenDrawer}
          aria-label="Buka menu dan filter"
          className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-(--sv-border) text-(--sv-text) hover:bg-(--sv-bg) xl:hidden"
        >
          <Menu className="size-4.5" strokeWidth={2} />
        </button>

        <Link href="/" className="flex shrink-0 items-center gap-2.5" title={SITE_NAME}>
          <span className="flex size-9 items-center justify-center rounded-lg bg-(--sv-primary) text-(--sv-primary-fg)">
            <TrendingUp className="size-5" strokeWidth={2.25} />
          </span>
          <span className="hidden leading-tight sm:block">
            <span className="block text-base font-bold text-(--sv-text)">{SITE_NAME}</span>
            <span className="block text-[11px] text-(--sv-muted)">Analisa lebih mudah, keputusan lebih baik</span>
          </span>
        </Link>

        <label className="relative ml-auto min-w-0 flex-1 md:ml-4 md:max-w-lg">
          <span className="sr-only">Cari saham</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-(--sv-muted)" strokeWidth={2} />
          <input
            type="search"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && onSubmitQuery) onSubmitQuery(query); }}
            placeholder="Cari kode saham, nama emiten, atau sektor…"
            className="h-10 w-full rounded-lg border border-(--sv-border) bg-(--sv-bg) pl-9 pr-3 text-sm text-(--sv-text) outline-none placeholder:text-(--sv-muted) focus:border-(--sv-primary) focus:bg-(--sv-surface) focus:ring-2 focus:ring-(--sv-primary)/15"
          />
        </label>

        <div className="hidden items-center gap-5 lg:flex">
          <div className="flex items-center gap-2.5">
            <span
              className={cn('size-2 rounded-full', marketOpen == null ? 'bg-slate-300' : marketOpen ? 'bg-emerald-500' : 'bg-slate-400')}
              title={marketOpen ? 'Pasar buka' : 'Pasar tutup'}
            />
            <div className="leading-tight">
              <p className="text-sm font-semibold text-(--sv-text)">
                IHSG <span className="tabular-nums">{ihsg ? idNum(ihsg.value) : '--'}</span>
              </p>
              <p className={cn('text-xs font-medium tabular-nums', ihsg == null ? 'text-(--sv-muted)' : up ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}>
                {ihsg ? `${up ? '+' : ''}${idNum(ihsg.change)} (${up ? '+' : ''}${idNum(ihsg.changePct)}%)` : '--'}
                <span className="ml-1.5 text-(--sv-muted)">· {marketOpen == null ? '' : marketOpen ? 'Pasar buka' : 'Pasar tutup'}</span>
              </p>
            </div>
          </div>

          {lastUpdatedAt && (
            <div className="border-l border-(--sv-border) pl-5 text-xs leading-tight text-(--sv-muted)">
              <p className="font-medium text-(--sv-text)">
                {lastUpdatedAt.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
              <p>Data EOD · {lastUpdatedAt.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB</p>
            </div>
          )}
        </div>

        <div className="shrink-0">
          <AuthButton />
        </div>
      </div>
    </header>
  );
}
