'use client';

import { BookOpen, GitCompare, Search, SlidersHorizontal, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { SITE_NAME, SITE_SLOGAN } from '@/lib/site';
import { AuthButton } from '@/presentation/features/auth/AuthButton';

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
    <header className="sticky top-0 z-20 neo-border border-x-0 border-t-0 bg-white dark:bg-zinc-950">
      <div className="mx-auto flex w-full max-w-7xl items-center gap-3 px-4 py-3 sm:gap-4 sm:px-6">
        <div className="flex shrink-0 items-center gap-2">
          <span className="flex size-9 items-center justify-center neo-border bg-emerald-400 text-black neo-shadow-sm dark:bg-emerald-400">
            <TrendingUp className="size-5" strokeWidth={2.75} />
          </span>
          <span className="hidden text-lg font-bold uppercase tracking-tight text-zinc-900 sm:inline dark:text-zinc-50">
            {SITE_NAME}
          </span>
        </div>

        <button
          type="button"
          onClick={onOpenDrawer}
          aria-label="Buka filter dan daftar pantau"
          className="neo-press relative flex size-9 shrink-0 items-center justify-center neo-border bg-white text-zinc-900 neo-shadow-sm lg:hidden dark:bg-zinc-900 dark:text-zinc-100"
        >
          <SlidersHorizontal className="size-4" strokeWidth={2.5} />
          {watchlistCount > 0 && (
            <span className="absolute -right-2 -top-2 flex size-5 items-center justify-center rounded-full border-2 border-(--neo-line) bg-(--neo-accent) text-[10px] font-bold text-black">
              {watchlistCount}
            </span>
          )}
        </button>

        <div className="relative ml-auto w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" strokeWidth={2.5} />
          <input
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Cari ticker atau nama..."
            className="w-full neo-border bg-white py-2 pl-9 pr-3 text-sm font-medium text-zinc-900 outline-none transition-shadow placeholder:text-zinc-400 focus:shadow-(--neo-shadow-sm) dark:bg-zinc-900 dark:text-zinc-100"
          />
        </div>

        <Link
          href="/compare"
          aria-label="Bandingkan saham"
          title="Bandingkan Saham"
          className="neo-press flex size-9 shrink-0 items-center justify-center neo-border bg-white text-zinc-900 neo-shadow-sm dark:bg-zinc-900 dark:text-zinc-100"
        >
          <GitCompare className="size-4" strokeWidth={2.5} />
        </Link>

        <Link
          href="/panduan"
          aria-label="Panduan istilah dan tutorial"
          title="Panduan & Tutorial"
          className="neo-press flex size-9 shrink-0 items-center justify-center neo-border bg-white text-zinc-900 neo-shadow-sm dark:bg-zinc-900 dark:text-zinc-100"
        >
          <BookOpen className="size-4" strokeWidth={2.5} />
        </Link>

        {/*  EOD • Jum, 08 Agu • 15:00 */}
        {lastUpdatedAt && (
          <span className="hidden shrink-0 text-xs font-semibold uppercase tracking-wide text-zinc-500 md:inline dark:text-zinc-400">
            EOD •{' '}
            {lastUpdatedAt.toLocaleDateString('id-ID', { weekday: 'short', day: '2-digit', month: 'short' })}
            {' • '}
            {lastUpdatedAt.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}

        {/* <AuthButton /> */}
      </div>
    </header>
  );
}
