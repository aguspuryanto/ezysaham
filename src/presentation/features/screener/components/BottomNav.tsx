import { cn } from '@/lib/format';
import { FilterChipItem } from './PresetTabs';

export function BottomNav({
  items,
  selected,
  onSelect,
}: {
  items: FilterChipItem[];
  selected: string;
  onSelect: (id: string) => void;
}) {
  return (
    <nav
      aria-label="Filter saham"
      className="fixed inset-x-0 bottom-0 z-30 flex border-t border-zinc-200 bg-white/95 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur-sm lg:hidden dark:border-zinc-800 dark:bg-zinc-950/95"
    >
      {items.map((item) => {
        const Icon = item.icon;
        const isSelected = item.id === selected;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.id)}
            aria-current={isSelected ? 'page' : undefined}
            className={cn(
              'flex flex-1 flex-col items-center gap-1 py-1.5 text-[11px] font-medium transition-colors',
              isSelected ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-400 dark:text-zinc-500'
            )}
          >
            <Icon className="size-5" strokeWidth={isSelected ? 2.5 : 2} />
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}
