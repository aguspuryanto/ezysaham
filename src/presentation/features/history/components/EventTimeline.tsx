import { TechnicalEvent } from '@/domain/models/TechnicalHistory';
import { cn } from '@/lib/format';

const TONE_CARD: Record<TechnicalEvent['tone'], string> = {
  bullish: 'border-emerald-500/40 bg-emerald-50 dark:bg-emerald-500/10 dark:border-emerald-500/30',
  bearish: 'border-rose-500/40 bg-rose-50 dark:bg-rose-500/10 dark:border-rose-500/30',
  neutral: 'border-zinc-300 bg-zinc-50 dark:bg-zinc-800/60 dark:border-zinc-700',
};

const TONE_TEXT: Record<TechnicalEvent['tone'], string> = {
  bullish: 'text-emerald-700 dark:text-emerald-400',
  bearish: 'text-rose-700 dark:text-rose-400',
  neutral: 'text-zinc-600 dark:text-zinc-400',
};

function formatEventDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

export function EventTimeline({ events, emptyLabel }: { events: TechnicalEvent[]; emptyLabel: string }) {
  if (events.length === 0) {
    return (
      <div className="neo-border neo-shadow-sm bg-white dark:bg-zinc-900 p-6 text-center text-sm font-semibold text-zinc-400">
        {emptyLabel}
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {events.map((event, i) => (
        <li key={`${event.date}-${event.type}-${i}`} className={cn('neo-border neo-shadow-sm border-2 p-4', TONE_CARD[event.tone])}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-lg leading-none">{event.icon}</span>
              <span className={cn('text-sm font-bold uppercase tracking-wide', TONE_TEXT[event.tone])}>{event.label}</span>
            </div>
            <span className="font-mono text-xs font-bold text-zinc-500 dark:text-zinc-400">{formatEventDate(event.date)}</span>
          </div>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">{event.summary}</p>
          {Object.keys(event.metrics).length > 0 && (
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t-2 border-(--neo-line) pt-2">
              {Object.entries(event.metrics).map(([k, v]) => (
                <div key={k} className="text-xs">
                  <span className="text-zinc-400 dark:text-zinc-500">{k}: </span>
                  <span className="font-mono font-bold text-zinc-700 dark:text-zinc-200">{v}</span>
                </div>
              ))}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
