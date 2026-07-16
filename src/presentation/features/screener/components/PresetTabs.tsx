import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/format';

export interface FilterChipItem {
  id: string;
  label: string;
  icon: LucideIcon;
}

export function PresetTabs({
  items,
  selected,
  onSelect,
}: {
  items: FilterChipItem[];
  selected: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {items.map((item) => {
        const Icon = item.icon;
        const isSelected = item.id === selected;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.id)}
            aria-pressed={isSelected}
            className={cn(
              'inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium transition-colors',
              isSelected
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800'
            )}
          >
            <Icon className="size-3.5" strokeWidth={2.25} />
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
