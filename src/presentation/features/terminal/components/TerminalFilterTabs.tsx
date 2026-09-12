'use client';

import { Building2, Crosshair, Eye, LayoutGrid, Rocket, ShieldCheck, Zap } from 'lucide-react';
import { FilterChipItem } from '@/presentation/features/screener/components/PresetTabs';
import { cn } from '@/lib/format';

const ROW_1: FilterChipItem[] = [
  { id: 'all', label: 'Semua Saham', icon: LayoutGrid },
  { id: 'dayTrading', label: 'Day Trading', icon: Zap },
  { id: 'swingHunter', label: 'Swing Hunter', icon: Crosshair },
  { id: 'fundamental', label: 'Fundamental', icon: Building2 },
  { id: 'highGrowth', label: 'High Growth', icon: Rocket },
  { id: 'corePortofolio', label: 'Core Portofolio', icon: ShieldCheck },
];

const ROW_2: FilterChipItem[] = [{ id: 'bandarDetector', label: 'Smart Money / Bandar', icon: Eye }];

function Chip({ item, selected, onSelect }: { item: FilterChipItem; selected: boolean; onSelect: (id: string) => void }) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      onClick={() => onSelect(item.id)}
      aria-pressed={selected}
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold',
        selected ? 'bg-(--term-cyan-strong) text-white' : 'border border-(--term-border) bg-(--term-surface) text-(--term-muted)'
      )}
    >
      <Icon className="size-3.5" strokeWidth={2.25} />
      {item.label}
    </button>
  );
}

export function TerminalFilterTabs({ selected, onSelect }: { selected: string; onSelect: (id: string) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {ROW_1.map((item) => (
          <Chip key={item.id} item={item} selected={selected === item.id} onSelect={onSelect} />
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {ROW_2.map((item) => (
          <Chip key={item.id} item={item} selected={selected === item.id} onSelect={onSelect} />
        ))}
      </div>
    </div>
  );
}
