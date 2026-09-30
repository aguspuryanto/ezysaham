'use client';

import { BookOpen, FlaskConical, GitCompare, Home, LayoutGrid, NotebookPen, PieChart, Radar, ScanSearch, Star } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/format';

/** Only routes that exist in the app — no dead menu items. */
const NAV_LINKS = [
  { href: '/', label: 'Beranda', icon: Home },
  { href: '/screener', label: 'Screener Saham', icon: ScanSearch },
  { href: '/signal', label: 'Signal', icon: Radar },
  { href: '/sektor', label: 'Sektor', icon: PieChart },
  { href: '/compare', label: 'Bandingkan', icon: GitCompare },
  { href: '/jurnal', label: 'Jurnal Trading', icon: NotebookPen },
  { href: '/backtest', label: 'Backtest', icon: FlaskConical },
  { href: '/panduan', label: 'Edukasi', icon: BookOpen },
  { href: '/blog', label: 'Blog', icon: LayoutGrid },
] as const;

export function ScreenerNav({
  watchlistOnly,
  watchlistCount,
  onToggleWatchlist,
}: {
  watchlistOnly: boolean;
  watchlistCount: number;
  onToggleWatchlist: () => void;
}) {
  const pathname = usePathname() ?? '/';
  // Screener stays highlighted on the pages that host it (/, /screener, /screener/[ticker]).
  const section = ['/signal', '/sektor', '/jurnal', '/panduan', '/blog'].find((p) => pathname.startsWith(p)) ?? '/screener';
  const isActive = (href: string) => href === section && !(href === '/screener' && watchlistOnly);
  const itemClass = 'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors';
  return (
    <nav aria-label="Menu utama" className="flex flex-col gap-0.5">
      {NAV_LINKS.slice(0, 3).map(({ href, label, icon: Icon }) => {
        const active = isActive(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(itemClass, active ? 'bg-(--sv-primary-soft) text-(--sv-primary) font-semibold' : 'text-(--sv-text) hover:bg-(--sv-bg)')}
          >
            <Icon className="size-4.5 shrink-0" strokeWidth={2} />
            {label}
          </Link>
        );
      })}
      <button
        type="button"
        onClick={onToggleWatchlist}
        aria-pressed={watchlistOnly}
        className={cn(itemClass, watchlistOnly ? 'bg-(--sv-primary-soft) text-(--sv-primary) font-semibold' : 'text-(--sv-text) hover:bg-(--sv-bg)')}
      >
        <Star className="size-4.5 shrink-0" strokeWidth={2} />
        Watchlist
        {watchlistCount > 0 && (
          <span className="ml-auto rounded-full bg-(--sv-primary) px-1.5 text-[11px] font-semibold text-(--sv-primary-fg) tabular-nums">{watchlistCount}</span>
        )}
      </button>
      {NAV_LINKS.slice(3).map(({ href, label, icon: Icon }) => {
        const active = isActive(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(itemClass, active ? 'bg-(--sv-primary-soft) text-(--sv-primary) font-semibold' : 'text-(--sv-text) hover:bg-(--sv-bg)')}
          >
            <Icon className="size-4.5 shrink-0" strokeWidth={2} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
