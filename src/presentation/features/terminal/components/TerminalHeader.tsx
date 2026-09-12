'use client';

import { LayoutGrid, LogOut, Menu, Newspaper, Search } from 'lucide-react';
import Link from 'next/link';
import { useAuthUser } from '@/presentation/features/auth/useAuthUser';
import { cn, formatPercent } from '@/lib/format';
import { IhsgQuote } from '../hooks/useIhsgQuote';

export function TerminalHeader({
  query,
  onQueryChange,
  ihsg,
  onOpenDrawer,
  compactGrid,
  onToggleCompactGrid,
}: {
  query: string;
  onQueryChange: (v: string) => void;
  ihsg: IhsgQuote | null;
  onOpenDrawer: () => void;
  compactGrid: boolean;
  onToggleCompactGrid: () => void;
}) {
  const { user, signInWithGoogle, signOut } = useAuthUser();

  return (
    <div className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-(--term-border) bg-(--term-surface) px-4 sm:px-5">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenDrawer}
          aria-label="Buka menu"
          className="flex size-8 shrink-0 items-center justify-center border border-(--term-border) text-(--term-muted) lg:hidden"
        >
          <Menu className="size-4" strokeWidth={2.25} />
        </button>

        <div className="flex size-8 shrink-0 items-center justify-center rounded-md border border-(--term-cyan-border) bg-(--term-cyan-tint)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--term-cyan-strong)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="12" width="4" height="8" rx="0.5" />
            <rect x="10" y="6" width="4" height="14" rx="0.5" />
            <rect x="17" y="9" width="4" height="11" rx="0.5" />
          </svg>
        </div>
        <div className="hidden min-w-0 flex-col leading-tight sm:flex">
          <div className="flex items-center gap-2">
            <span className="text-[15px] font-bold tracking-tight text-(--term-text)">EZYSAHAM</span>
            <span className="font-terminal-mono rounded border border-(--term-cyan-border) bg-(--term-cyan-tint) px-1.5 py-0.5 text-[10px] font-semibold text-(--term-cyan-strong)">
              TERMINAL
            </span>
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-(--term-muted)">Indonesia Stock Exchange Analytics</span>
        </div>
      </div>

      <div className="hidden items-center gap-2 md:flex">
        {ihsg && (
          <span className="font-terminal-mono inline-flex items-center gap-1.5 rounded border border-(--term-emerald-border) bg-(--term-emerald-tint) px-2.5 py-1 text-xs font-semibold text-(--term-emerald)">
            IHSG {new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(ihsg.value)}
            <span className="opacity-80">({formatPercent(ihsg.changePct)})</span>
          </span>
        )}
        <div className="flex w-56 items-center gap-2 rounded border border-(--term-border) bg-(--term-surface-sunken) px-2.5 py-1.5">
          <Search className="size-3.5 shrink-0 text-(--term-muted)" strokeWidth={2} />
          <input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Cari saham..."
            className="w-full bg-transparent text-xs text-(--term-text) outline-none placeholder:text-(--term-muted)"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Link href="/blog" className="hidden items-center gap-1.5 text-xs font-semibold text-(--term-muted) hover:text-(--term-cyan) lg:flex">
          <Newspaper className="size-3.5" strokeWidth={2} />
          Feed
        </Link>
        <button
          type="button"
          onClick={onToggleCompactGrid}
          aria-pressed={compactGrid}
          className={cn(
            'hidden items-center gap-1.5 rounded border px-2.5 py-1.5 text-[11px] font-semibold lg:flex',
            compactGrid ? 'border-(--term-cyan-border) bg-(--term-cyan-tint) text-(--term-cyan-strong)' : 'border-(--term-border) text-(--term-muted)'
          )}
        >
          <LayoutGrid className="size-3.5" strokeWidth={2} />
          Compact Grid
        </button>

        <div className="flex items-center gap-2 border-l border-(--term-border) pl-3">
          {user ? (
            <>
              <div className="hidden flex-col text-right leading-tight sm:flex">
                <span className="text-xs font-bold text-(--term-text)">{user.user_metadata?.full_name ?? user.email}</span>
                <span className="font-terminal-mono text-[10px] font-semibold text-(--term-cyan-strong)">Masuk</span>
              </div>
              <button type="button" onClick={() => signOut()} aria-label="Keluar" className="flex size-8 items-center justify-center rounded-md border border-(--term-border) text-(--term-muted) hover:text-(--term-crimson)">
                <LogOut className="size-3.5" strokeWidth={2} />
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => signInWithGoogle()}
              className="rounded-md bg-(--term-cyan-strong) px-3 py-1.5 text-xs font-semibold text-white"
            >
              Masuk
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
