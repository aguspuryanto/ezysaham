'use client';

import { KeyboardEvent, useRef } from 'react';
import { cn } from '@/lib/format';

export const STOCK_TABS = [
  { id: 'ringkasan', label: 'Ringkasan' },
  { id: 'chart', label: 'Chart' },
  { id: 'fundamental', label: 'Fundamental' },
  { id: 'technical', label: 'Technical' },
  { id: 'bandarmology', label: 'Bandarmology' },
  { id: 'valuation', label: 'Valuation' },
  { id: 'corporate-action', label: 'Corporate Action' },
  { id: 'news', label: 'News' },
] as const;

export type StockTabId = (typeof STOCK_TABS)[number]['id'];

/** Horizontal tabs — scroll sideways on narrow screens, arrow keys move between tabs. */
export function StockTabs({ active, onChange }: { active: StockTabId; onChange: (id: StockTabId) => void }) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const onKeyDown = (e: KeyboardEvent, index: number) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const next = (index + (e.key === 'ArrowRight' ? 1 : -1) + STOCK_TABS.length) % STOCK_TABS.length;
    refs.current[next]?.focus();
    onChange(STOCK_TABS[next].id);
  };

  return (
    <div className="rounded-xl border border-(--sv-border) bg-(--sv-surface) shadow-(--sv-shadow)">
      <div role="tablist" aria-label="Bagian detail emiten" className="flex overflow-x-auto px-2 [scrollbar-width:none]">
        {STOCK_TABS.map((tab, i) => {
          const selected = tab.id === active;
          return (
            <button
              key={tab.id}
              ref={(el) => { refs.current[i] = el; }}
              type="button"
              role="tab"
              id={`tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={`panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(tab.id)}
              onKeyDown={(e) => onKeyDown(e, i)}
              className={cn(
                'relative shrink-0 whitespace-nowrap px-4 py-3 text-sm transition-colors',
                selected ? 'font-semibold text-(--sv-primary)' : 'font-medium text-(--sv-muted) hover:text-(--sv-text)',
              )}
            >
              {tab.label}
              <span
                aria-hidden="true"
                className={cn('absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-(--sv-primary) transition-opacity', selected ? 'opacity-100' : 'opacity-0')}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
