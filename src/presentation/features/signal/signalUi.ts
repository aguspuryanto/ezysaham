import { SignalAction } from '@/domain/models/Signal';
import { Tone } from '../screener/detail/format';

/** Color coding per signal — same as the detail page: green = BUY, amber = WAIT, red = AVOID. */
export const ACTION_TONE: Record<SignalAction, Tone> = {
  BUY: 'positive',
  WAIT: 'warning',
  AVOID: 'negative',
};

export function scoreTone(score: number): Tone {
  if (score >= 75) return 'positive';
  if (score >= 55) return 'warning';
  return 'negative';
}

export const SCORE_BAR: Record<Tone, string> = {
  positive: 'bg-emerald-500',
  warning: 'bg-amber-500',
  negative: 'bg-rose-500',
  info: 'bg-blue-500',
  neutral: 'bg-slate-400',
};

/** "1:2,8". */
export function fmtRR(rr: number): string {
  return `1:${rr.toLocaleString('id-ID', { maximumFractionDigits: 1 })}`;
}

export function fmtDateLong(date: string): string {
  return new Date(`${date}T00:00:00+07:00`).toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta',
  });
}

export function fmtTimestamp(iso: string): string {
  return new Date(iso).toLocaleString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta',
  }) + ' WIB';
}
