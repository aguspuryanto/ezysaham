'use client';

import { Award, Gauge, Rocket, Wallet } from 'lucide-react';
import { MarketPulse, MarketPulseCard } from '../hooks/useMarketPulse';

function StatCard({
  icon: Icon,
  iconColor,
  label,
  card,
}: {
  icon: typeof Gauge;
  iconColor: string;
  label: string;
  card: MarketPulseCard | null;
}) {
  return (
    <div className="rounded-lg border border-(--term-border) bg-(--term-surface) p-3.5">
      <div className="mb-2.5 flex items-center justify-between">
        <span className="font-terminal-mono text-[10px] font-semibold uppercase tracking-wide text-(--term-muted)">{label}</span>
        <Icon className="size-4" style={{ color: iconColor }} strokeWidth={2} />
      </div>
      {card ? (
        <>
          <div className="mb-3 flex items-baseline gap-2">
            <span className="font-terminal-mono text-xl font-bold text-(--term-text)">{card.ticker}</span>
            <span className="font-terminal-mono text-xs text-(--term-muted)">{card.metric}</span>
          </div>
          <div className="flex items-center justify-between border-t border-(--term-border) pt-2.5 text-xs">
            <span className="truncate text-(--term-muted)">{card.name}</span>
            <span className="font-terminal-mono shrink-0 font-semibold text-(--term-emerald)">{card.sub}</span>
          </div>
        </>
      ) : (
        <div className="py-3 text-xs text-(--term-muted)">Menghitung...</div>
      )}
    </div>
  );
}

export function TerminalStatCards({ pulse }: { pulse: MarketPulse }) {
  return (
    <div className="grid shrink-0 grid-cols-1 gap-3 px-4 py-3.5 sm:grid-cols-2 sm:px-5 lg:grid-cols-4">
      <StatCard icon={Gauge} iconColor="var(--term-amber)" label="Top RVOL Spike" card={pulse.topRvol} />
      <StatCard icon={Award} iconColor="var(--term-cyan-strong)" label="AI Top Ranked Setup" card={pulse.topRanked} />
      <StatCard icon={Wallet} iconColor="var(--term-emerald)" label="Top Value Traded" card={pulse.topValue} />
      <StatCard icon={Rocket} iconColor="var(--term-cyan-strong)" label="Top Gainer" card={pulse.topGainer} />
    </div>
  );
}
