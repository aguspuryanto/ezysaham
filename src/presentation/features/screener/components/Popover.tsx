'use client';

/**
 * Popover.tsx
 *
 * Small fixed-position popover rendered in a portal, so it is never clipped by the Screener
 * table's scroll container (overflow: auto + sticky header). `mode="hover"` for tooltips,
 * `mode="click"` for menus. Closes on outside click, Escape, scroll and resize.
 */

import { HelpCircle } from 'lucide-react';
import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/format';
import { screenerInter } from '../fonts';

const GAP = 6;
const MARGIN = 8;

export function Popover({
  trigger,
  label,
  children,
  mode = 'hover',
  width = 260,
  className,
  triggerClassName,
}: {
  trigger: ReactNode;
  /** Accessible name of the trigger button. */
  label: string;
  children: ReactNode | ((close: () => void) => ReactNode);
  mode?: 'hover' | 'click';
  width?: number;
  className?: string;
  triggerClassName?: string;
}) {
  const [pos, setPos] = useState<{ top: number; left: number; above: boolean } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const close = useCallback(() => setPos(null), []);
  const open = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const left = Math.min(Math.max(MARGIN, r.left + r.width / 2 - width / 2), window.innerWidth - width - MARGIN);
    const above = r.bottom + 220 > window.innerHeight && r.top > 220;
    setPos({ top: above ? r.top - GAP : r.bottom + GAP, left, above });
  }, [width]);

  useEffect(() => {
    if (!pos) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || triggerRef.current?.contains(t)) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [pos, close]);

  const hoverProps = mode === 'hover'
    ? {
      onMouseEnter: () => { if (hoverTimer.current) clearTimeout(hoverTimer.current); open(); },
      onMouseLeave: () => { hoverTimer.current = setTimeout(close, 120); },
      onFocus: open,
      onBlur: close,
    }
    : {};

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-expanded={pos != null}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (pos) close(); else open();
        }}
        className={cn('inline-flex items-center justify-center', triggerClassName)}
        {...hoverProps}
      >
        {trigger}
      </button>
      {pos && createPortal(
        <div
          ref={panelRef}
          role={mode === 'hover' ? 'tooltip' : 'menu'}
          onClick={(e) => e.stopPropagation()}
          onMouseEnter={mode === 'hover' ? () => { if (hoverTimer.current) clearTimeout(hoverTimer.current); } : undefined}
          onMouseLeave={mode === 'hover' ? () => { hoverTimer.current = setTimeout(close, 120); } : undefined}
          style={{ top: pos.top, left: pos.left, width, transform: pos.above ? 'translateY(-100%)' : undefined }}
          className={cn(
            screenerInter.variable,
            'sv-theme fixed z-[70] rounded-lg border border-(--sv-border) bg-(--sv-surface) p-3 text-left text-[13px] font-normal normal-case tracking-normal leading-relaxed text-(--sv-text) shadow-lg',
            className,
          )}
        >
          {typeof children === 'function' ? children(close) : children}
        </div>,
        document.body,
      )}
    </>
  );
}

/** "?" glossary tooltip next to a technical/fundamental term. */
export function InfoTip({ term, text }: { term: string; text: string }) {
  return (
    <Popover
      label={`Penjelasan ${term}`}
      trigger={<HelpCircle className="size-3.5" strokeWidth={2} />}
      triggerClassName="rounded-full text-(--sv-muted) hover:text-(--sv-primary) focus-visible:outline-2 focus-visible:outline-(--sv-primary)"
    >
      <p className="font-semibold">{term}</p>
      <p className="mt-1 text-(--sv-muted)">{text}</p>
    </Popover>
  );
}
