'use client';

/**
 * AppShell.tsx
 *
 * The Screener's page chrome — sticky ScreenerHeader, sidebar nav (drawer on
 * mobile/tablet) and the `.sv-theme` wrapper — for pages that only need to
 * supply their main content.
 */

import { X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { ReactNode, useEffect, useState } from 'react';
import { cn } from '@/lib/format';
import { SITE_NAME } from '@/lib/site';
import { screenerInter } from '../fonts';
import { useWatchlist } from '../hooks/useWatchlist';
import { useMarketSeries } from './MarketSummary';
import { ScreenerHeader } from './ScreenerHeader';
import { ScreenerNav } from './ScreenerNav';

/**
 * Search is controlled when `query`/`onQueryChange` are passed; otherwise (e.g. from a server
 * page) it keeps its own state and Enter jumps to the typed ticker, like Detail Emiten.
 */
export function AppShell({ query, onQueryChange, onSubmitQuery, lastUpdatedAt = null, children }: {
  query?: string;
  onQueryChange?: (q: string) => void;
  onSubmitQuery?: (q: string) => void;
  lastUpdatedAt?: Date | null;
  children: ReactNode;
}) {
  const router = useRouter();
  const market = useMarketSeries();
  const watchlist = useWatchlist();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [ownQuery, setOwnQuery] = useState('');
  const jumpToTicker = (q: string) => {
    const code = q.trim().toUpperCase();
    if (/^[A-Z]{4}$/.test(code)) router.push(`/screener/${code}`);
    else if (code) router.push('/screener');
  };

  // Mobile/tablet drawer: lock body scroll and close on Escape.
  useEffect(() => {
    if (!drawerOpen) return;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') setDrawerOpen(false); };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [drawerOpen]);

  return (
    <div className={cn('sv-theme flex min-h-screen w-full flex-col', screenerInter.variable)}>
      <ScreenerHeader
        query={query ?? ownQuery}
        onQueryChange={onQueryChange ?? setOwnQuery}
        onSubmitQuery={onSubmitQuery ?? (onQueryChange ? undefined : jumpToTicker)}
        lastUpdatedAt={lastUpdatedAt}
        ihsg={market.ihsg}
        onOpenDrawer={() => setDrawerOpen(true)}
      />

      <div className="flex flex-1">
        {drawerOpen && <div className="fixed inset-0 z-40 bg-slate-900/40 xl:hidden" onClick={() => setDrawerOpen(false)} aria-hidden="true" />}
        <aside
          aria-label="Menu utama"
          className={cn(
            'fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col gap-6 overflow-y-auto border-r border-(--sv-border) bg-(--sv-surface) p-4 transition-transform duration-300 ease-out',
            drawerOpen ? 'translate-x-0 shadow-xl' : '-translate-x-full',
            'xl:sticky xl:top-16 xl:z-auto xl:h-[calc(100vh-4rem)] xl:w-64 xl:max-w-none xl:shrink-0 xl:translate-x-0 xl:shadow-none',
          )}
        >
          <div className="flex items-center justify-between xl:hidden">
            <span className="text-sm font-semibold text-(--sv-text)">Menu</span>
            <button type="button" onClick={() => setDrawerOpen(false)} aria-label="Tutup" className="flex size-8 items-center justify-center rounded-lg border border-(--sv-border) text-(--sv-text)">
              <X className="size-4" strokeWidth={2} />
            </button>
          </div>
          <ScreenerNav watchlistCount={watchlist.tickers.length} />
          <p className="mt-auto text-[11px] text-(--sv-muted)">© {new Date().getFullYear()} {SITE_NAME} · Data EOD, bukan prediksi harga.</p>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col gap-5 px-4 py-5 pb-28 sm:px-6 xl:pb-8">{children}</div>
      </div>
    </div>
  );
}
