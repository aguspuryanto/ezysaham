import { SmCategoryKey, SmGateResult, SmStatus, SmartMoneyResult, STATUS_LABEL } from '@/domain/analysis/smartMoneyHunter';
import { DASH, Tone } from '../screener/detail/format';

export const STATUS_TONE: Record<SmStatus, Tone> = {
  BUY_CANDIDATE: 'positive',
  WAIT: 'info',
  AVOID_CHASING: 'warning',
  NO_TRADE: 'negative',
  INSUFFICIENT_DATA: 'neutral',
};

export const GATE_TONE: Record<SmGateResult, Tone> = { PASS: 'positive', FAIL: 'negative', UNKNOWN: 'neutral' };

export const statusLabel = (s: SmStatus) => STATUS_LABEL[s];

export const CATEGORY_SHORT: Record<SmCategoryKey, string> = {
  foreign: 'Asing',
  broker: 'Broker',
  activity: 'Aktivitas',
  momentum: 'Momentum',
  fundamental: 'Fundamental',
};

/** "Rp3,3 M" / "−Rp120 jt" — M = miliar, jt = juta (units spelled out to avoid the M/juta ambiguity). */
export function fmtRpShort(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return DASH;
  const a = Math.abs(v), s = v < 0 ? '−' : '';
  const f = (n: number, d: number) => n.toLocaleString('id-ID', { maximumFractionDigits: d });
  if (a >= 1e12) return `${s}Rp${f(a / 1e12, 2)} T`;
  if (a >= 1e9) return `${s}Rp${f(a / 1e9, 2)} M`;
  if (a >= 1e6) return `${s}Rp${f(a / 1e6, 1)} jt`;
  return `${s}Rp${f(a, 0)}`;
}

export function fmtRatio(v: number | null | undefined, dec = 2): string {
  return v == null || !Number.isFinite(v) ? DASH : `${v.toLocaleString('id-ID', { maximumFractionDigits: dec })}x`;
}

export function fmtShare(v: number | null | undefined, dec = 1): string {
  return v == null || !Number.isFinite(v) ? DASH : `${(v * 100).toLocaleString('id-ID', { maximumFractionDigits: dec })}%`;
}

export const categoryOf = (r: SmartMoneyResult, key: SmCategoryKey) => r.categories.find((c) => c.key === key)!;
