import { cva } from 'class-variance-authority';

export type Tone = 'green' | 'red' | 'amber' | 'blue' | 'zinc';

export const toneBadgeVariants = cva('rounded-full border font-medium', {
  variants: {
    tone: {
      green: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-400/10 dark:text-emerald-300 dark:border-emerald-400/20',
      red: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-400/10 dark:text-rose-300 dark:border-rose-400/20',
      amber: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-400/10 dark:text-amber-300 dark:border-amber-400/20',
      blue: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-400/10 dark:text-blue-300 dark:border-blue-400/20',
      zinc: 'bg-muted text-muted-foreground border-border',
    },
  },
  defaultVariants: { tone: 'zinc' },
});

/** Border + background for tone-tinted block rows (LevelRow, FundamentalSection metrics, checklist points, banner example rows). */
export const TONE_SURFACE: Record<Tone, string> = {
  green: 'border-emerald-200 bg-emerald-50 dark:border-emerald-400/20 dark:bg-emerald-400/5',
  red: 'border-rose-200 bg-rose-50 dark:border-rose-400/20 dark:bg-rose-400/5',
  amber: 'border-amber-200 bg-amber-50 dark:border-amber-400/20 dark:bg-amber-400/5',
  blue: 'border-blue-200 bg-blue-50 dark:border-blue-400/20 dark:bg-blue-400/5',
  zinc: 'border-border bg-muted',
};

/** Label text color to pair with TONE_SURFACE. */
export const TONE_TEXT: Record<Tone, string> = {
  green: 'text-emerald-700 dark:text-emerald-300',
  red: 'text-rose-700 dark:text-rose-300',
  amber: 'text-amber-700 dark:text-amber-300',
  blue: 'text-blue-700 dark:text-blue-300',
  zinc: 'text-foreground',
};

/** Muted detail/sub-text color to pair with TONE_SURFACE. */
export const TONE_DETAIL_TEXT: Record<Tone, string> = {
  green: 'text-emerald-600/80 dark:text-emerald-400/70',
  red: 'text-rose-600/80 dark:text-rose-400/70',
  amber: 'text-amber-600/80 dark:text-amber-400/70',
  blue: 'text-blue-600/80 dark:text-blue-400/70',
  zinc: 'text-muted-foreground',
};

/** Solid background (white text) for verdict chips. */
export const TONE_SOLID: Record<Tone, string> = {
  green: 'bg-emerald-600 dark:bg-emerald-600',
  red: 'bg-rose-600 dark:bg-rose-600',
  amber: 'bg-amber-500 dark:bg-amber-600',
  blue: 'bg-blue-600 dark:bg-blue-600',
  zinc: 'bg-muted-foreground',
};
