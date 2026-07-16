'use client';

import { Search, SlidersHorizontal, TrendingUp } from 'lucide-react';
import { SITE_NAME } from '@/lib/site';

export function AppHeader({
  query,
  onQueryChange,
  lastUpdatedAt,
  onOpenDrawer,
  watchlistCount,
}: {
  query: string;
  onQueryChange: (query: string) => void;
  lastUpdatedAt: Date | null;
  onOpenDrawer: () => void;
  watchlistCount: number;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
      <div className="mx-auto flex w-full max-w-7xl items-center gap-3 px-4 py-3 sm:gap-4 sm:px-6">
        <div className="flex shrink-0 items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-emerald-600 text-white">
            <TrendingUp className="size-4.5" strokeWidth={2.5} />
          </span>
          <span className="hidden text-base font-semibold tracking-tight text-zinc-900 sm:inline dark:text-zinc-50">
            {SITE_NAME}
          </span>
        </div>

        <button
          type="button"
          onClick={onOpenDrawer}
          aria-label="Buka filter dan daftar pantau"
          className="relative flex size-9 shrink-0 items-center justify-center rounded-xl border border-zinc-200 text-zinc-600 transition-colors hover:bg-zinc-50 lg:hidden dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900"
        >
          <SlidersHorizontal className="size-4" />
          {watchlistCount > 0 && (
            <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-emerald-600 text-[9px] font-semibold text-white">
              {watchlistCount}
            </span>
          )}
        </button>

        <div className="relative ml-auto w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Cari ticker atau nama..."
            className="w-full rounded-xl border border-zinc-200 bg-zinc-50 py-2 pl-9 pr-3 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/15 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:bg-zinc-900"
          />
        </div>

        {lastUpdatedAt && (
          <span className="hidden shrink-0 text-xs text-zinc-400 md:inline dark:text-zinc-500">
            Update {lastUpdatedAt.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>
    </header>
  );
}
