import { cn } from '@/lib/format';

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: React.ReactNode;
  tone?: 'neutral' | 'positive' | 'negative';
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset',
        tone === 'positive' &&
          'bg-emerald-50 text-emerald-700 ring-emerald-600/15 dark:bg-emerald-400/10 dark:text-emerald-300 dark:ring-emerald-400/20',
        tone === 'negative' &&
          'bg-rose-50 text-rose-700 ring-rose-600/15 dark:bg-rose-400/10 dark:text-rose-300 dark:ring-rose-400/20',
        tone === 'neutral' &&
          'bg-zinc-100 text-zinc-600 ring-zinc-500/10 dark:bg-zinc-400/10 dark:text-zinc-300 dark:ring-zinc-400/15',
        className
      )}
    >
      <span
        className={cn(
          'size-1 rounded-full',
          tone === 'positive' && 'bg-emerald-500',
          tone === 'negative' && 'bg-rose-500',
          tone === 'neutral' && 'bg-zinc-400'
        )}
      />
      {children}
    </span>
  );
}
