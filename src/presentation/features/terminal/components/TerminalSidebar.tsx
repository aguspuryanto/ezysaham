'use client';

import {
  Briefcase,
  Building2,
  LayoutGrid,
  LineChart,
  ListTree,
  Star,
  X,
} from 'lucide-react';
import { cn } from '@/lib/format';

const DISABLED_NAV = [
  { label: 'Market Overview', icon: LineChart },
  { label: 'Orderbook Depth', icon: ListTree },
  { label: 'Broker Summary', icon: Building2 },
  { label: 'Portfolio & Orders', icon: Briefcase },
  { label: 'Financial Ratios', icon: LayoutGrid },
];

export function TerminalSidebar({
  open,
  onClose,
  watchlistTickers,
  summariesCount,
  connectionMs,
  sessionEndsAt,
  sessionOpen,
}: {
  open: boolean;
  onClose: () => void;
  watchlistTickers: string[];
  summariesCount: number;
  connectionMs: number | null;
  sessionEndsAt: string | null;
  sessionOpen: boolean;
}) {
  return (
    <aside
      role="dialog"
      aria-modal={open}
      aria-label="Navigasi"
      className={cn(
        'fixed top-0 bottom-0 left-0 z-40 flex w-64 max-w-[85vw] flex-col gap-4 overflow-y-auto border-r border-(--term-border) bg-(--term-surface) p-3.5 transition-transform duration-300 ease-out',
        open ? 'translate-x-0' : '-translate-x-full',
        'lg:sticky lg:top-0 lg:bottom-auto lg:left-auto lg:z-auto lg:h-[calc(100vh-1rem)] lg:w-64 lg:max-w-none lg:shrink-0 lg:translate-x-0 lg:rounded-lg lg:border'
      )}
    >
      <div className="flex items-center justify-between lg:hidden">
        <span className="text-sm font-bold text-(--term-text)">Navigasi</span>
        <button type="button" onClick={onClose} aria-label="Tutup" className="flex size-8 items-center justify-center border border-(--term-border) text-(--term-muted)">
          <X className="size-4" strokeWidth={2.5} />
        </button>
      </div>

      <div className="flex flex-col gap-0.5">
        <span className="font-terminal-mono px-2 pb-1.5 text-[10px] font-bold uppercase tracking-wide text-(--term-muted)">Navigation Engine</span>
        <div className="flex items-center justify-between rounded-md border-l-2 border-(--term-cyan-strong) bg-(--term-cyan-tint) px-2 py-2">
          <span className="flex items-center gap-2 text-[13px] font-bold text-(--term-cyan-strong)">
            <LayoutGrid className="size-3.5" strokeWidth={2.25} />
            Screener Terminal
          </span>
          <span className="font-terminal-mono text-[11px] text-(--term-cyan-strong)">{summariesCount}</span>
        </div>
        {DISABLED_NAV.map(({ label, icon: Icon }) => (
          <div key={label} className="flex items-center justify-between px-2 py-2 opacity-50">
            <span className="flex items-center gap-2 text-[13px] font-semibold text-(--term-muted)">
              <Icon className="size-3.5" strokeWidth={2.25} />
              {label}
            </span>
            <span className="font-terminal-mono rounded border border-(--term-border) px-1.5 py-0.5 text-[9px] font-bold text-(--term-muted)">SEGERA</span>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-0.5 border-t border-(--term-border) pt-3">
        <span className="font-terminal-mono px-2 pb-1.5 text-[10px] font-bold uppercase tracking-wide text-(--term-muted)">Watchlist Saya</span>
        {watchlistTickers.length === 0 ? (
          <p className="px-2 text-[11px] text-(--term-muted)">Klik ikon bintang pada saham untuk menambahkannya.</p>
        ) : (
          watchlistTickers.map((t) => (
            <div key={t} className="flex items-center gap-2 px-2 py-1.5 text-[13px] font-semibold text-(--term-text)">
              <Star className="size-3.5 shrink-0" style={{ color: 'var(--term-gold)' }} fill="var(--term-gold)" strokeWidth={0} />
              {t}
            </div>
          ))
        )}
      </div>

      <div className="mt-auto flex flex-col gap-1.5 border-t border-(--term-border) pt-3">
        <div className="flex items-center justify-between">
          <span className="font-terminal-mono text-[10px] text-(--term-muted)">KONEKSI DATA</span>
          <span className={cn('font-terminal-mono text-[11px] font-bold', connectionMs != null ? 'text-(--term-emerald)' : 'text-(--term-muted)')}>
            {connectionMs != null ? `TERHUBUNG ${connectionMs}ms` : '—'}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="font-terminal-mono text-[10px] text-(--term-muted)">SESI</span>
          <span className="font-terminal-mono text-[11px] font-bold text-(--term-text)">{sessionOpen && sessionEndsAt ? `Berakhir ${sessionEndsAt}` : 'Tutup'}</span>
        </div>
      </div>
    </aside>
  );
}
