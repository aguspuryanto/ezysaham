import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/format';

export interface ScreenerTabItem {
  id: string;
  label: string;
  icon: LucideIcon;
}

export function ScreenerTabs({ items, selected, onSelect, count }: {
  items: ScreenerTabItem[];
  selected: string;
  onSelect: (id: string) => void;
  /** Result count of the active tab (other tabs aren't scanned until opened). */
  count: number | null;
}) {
  return (
    <div role="tablist" aria-label="Preset screener" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
      {items.map(({ id, label, icon: Icon }) => {
        const active = id === selected;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onSelect(id)}
            className={cn(
              'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border px-3.5 text-sm font-medium transition-colors',
              active
                ? 'border-(--sv-primary) bg-(--sv-primary) text-(--sv-primary-fg)'
                : 'border-(--sv-border) bg-(--sv-surface) text-(--sv-text) hover:bg-(--sv-bg)',
            )}
          >
            <Icon className="size-4" strokeWidth={2} />
            {label}
            {active && count != null && <span className="tabular-nums opacity-80">({count})</span>}
          </button>
        );
      })}
    </div>
  );
}
