/**
 * momentumSetups.ts
 *
 * Building blocks of the Momentum Trade Engine (docs/features_momentum_engine.md § Swing v2), each a pure
 * function of DAILY OHLCV that only reads bars at or before the analysed candle (no look-ahead):
 *
 *   • assessData       — enough bars, stale snapshot, today's candle not yet closed, zero-volume sessions.
 *   • liquidityOf      — average traded value of the last 20 sessions (close × volume).
 *   • swingPivots      — swing highs / lows confirmed by `k` bars on BOTH sides (the last k bars are never pivots).
 *   • detectBreakout   — CLOSE above the prior 20-session high + RVOL + strong candle, inside the entry zone.
 *   • detectRetest     — a volume breakout in the last 8 sessions, price back at the level, support held.
 *   • detectPullback   — bullish trend, dip into the EMA 9–20 zone on light volume, then a bounce candle.
 *   • detectConsolidation — a tight, defined range (≥ 6 sessions) with a clear breakout trigger.
 *   • netRiskReward    — R:R after IDX fees and slippage (≥ 1 tick).
 *
 * Every setup returns: state, activation condition, trigger price/zone, invalidation, structural low (for the
 * SL) and the reason it is or isn't valid. A setup the data can't show is ABSENT — never assumed.
 */

import { idxTickSize } from '@/domain/analysis/idxTick';
import { OHLCVBar } from '@/domain/models/History';

// ─── Shared thresholds ──────────────────────────────────────────────────────────

/** Prior-session window for the breakout level / RVOL baseline. */
export const BREAKOUT_LOOKBACK = 20;
/** Breakout volume confirmation (last volume ÷ average of the PRIOR 20 sessions). */
export const BREAKOUT_RVOL = 1.5;
/** Entry zone above a breakout level: max(this %, 0.5 × ATR%), capped at MAX_ZONE_PCT. Beyond it = chasing. */
export const BREAKOUT_ZONE_PCT = 3;
const MAX_ZONE_PCT = 6;
/** Close within max(this %, 1.5 × ATR%) under the level → a pending breakout. */
const NEAR_BREAKOUT_PCT = 5;
/** Retest: the breakout bar must sit within the last this-many sessions. */
const RETEST_MAX_AGE = 8;
/** SL buffer under a structural level, in ATRs. */
export const SL_BUFFER_ATR = 0.5;
/** IDX regular session incl. closing auction ends ≈ 16:15 WIB (UTC+7) — before that today's bar is provisional. */
const IDX_CLOSE_MINUTES_WIB = 16 * 60 + 15;
const WIB_OFFSET_MS = 7 * 3600_000;

const pct = (a: number, b: number) => (a / b - 1) * 100;
const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : NaN);
const rp = (n: number) => `Rp ${Math.round(n).toLocaleString('id-ID')}`;
const r1 = (n: number) => (Math.round(n * 10) / 10).toLocaleString('id-ID', { maximumFractionDigits: 1 });

// ─── Data quality ───────────────────────────────────────────────────────────────

export type DataStatus = 'OK' | 'PROVISIONAL' | 'STALE' | 'SUSPECT' | 'INSUFFICIENT';

export interface DataQuality {
  /** Enough bars to compute anything at all. */
  usable: boolean;
  /** Data gate: usable + fresh + last candle closed + no suspension pattern. */
  gateOk: boolean;
  status: DataStatus;
  timeframe: '1D';
  lastBarDate: string | null;
  lastBarClosed: boolean;
  ageInTradingDays: number | null;
  /** Sessions with zero volume among the last 20 (suspension / no trades). */
  zeroVolumeDays: number;
  notes: string[];
}

function weekdaysBetween(fromIso: string, toIso: string): number {
  const cur = new Date(`${fromIso}T00:00:00Z`);
  const end = new Date(`${toIso}T00:00:00Z`);
  let n = 0;
  cur.setUTCDate(cur.getUTCDate() + 1);
  while (cur < end) {
    const d = cur.getUTCDay();
    if (d !== 0 && d !== 6) n += 1;
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return n;
}

/**
 * `asOf` = when the analysis runs. Omitted (backtests, historical replays) → the last bar is treated as a
 * closed candle and freshness is not judged. Stale = ≥ 3 weekdays between the last bar and today (WIB),
 * the same rule as dataFreshness.ts (IDX holidays are not modelled).
 */
export function assessData(bars: OHLCVBar[], minBars: number, asOf?: Date): DataQuality {
  const lastBarDate = bars.length ? bars[bars.length - 1].date : null;
  const zeroVolumeDays = bars.slice(-20).filter((b) => !(b.volume > 0)).length;
  const base: DataQuality = {
    usable: true, gateOk: true, status: 'OK', timeframe: '1D', lastBarDate, lastBarClosed: true,
    ageInTradingDays: null, zeroVolumeDays, notes: [],
  };
  if (bars.length < minBars) {
    return { ...base, usable: false, gateOk: false, status: 'INSUFFICIENT', notes: [`Riwayat harga baru ${bars.length} sesi (butuh ≥ ${minBars}).`] };
  }
  const notes: string[] = [];
  let status: DataStatus = 'OK';
  if (asOf && lastBarDate) {
    const wib = new Date(asOf.getTime() + WIB_OFFSET_MS);
    const today = wib.toISOString().slice(0, 10);
    const minutes = wib.getUTCHours() * 60 + wib.getUTCMinutes();
    base.ageInTradingDays = lastBarDate >= today ? 0 : weekdaysBetween(lastBarDate, today);
    if (lastBarDate === today && minutes < IDX_CLOSE_MINUTES_WIB && wib.getUTCDay() % 6 !== 0) {
      base.lastBarClosed = false;
      status = 'PROVISIONAL';
      notes.push('Candle hari ini belum ditutup (sesi BEI selesai ±16:15 WIB) — sinyal close belum final.');
    } else if (base.ageInTradingDays >= 3) {
      status = 'STALE';
      notes.push(`Data stale — candle terakhir ${lastBarDate} (${base.ageInTradingDays} hari bursa lalu).`);
    }
  }
  if (zeroVolumeDays >= 5) {
    if (status === 'OK') status = 'SUSPECT';
    notes.push(`${zeroVolumeDays} dari 20 sesi terakhir tanpa transaksi (indikasi suspensi / tidak likuid) — ATR, RSI & struktur bisa bias.`);
  }
  return { ...base, status, gateOk: status === 'OK', notes };
}

// ─── Liquidity ──────────────────────────────────────────────────────────────────

export interface Liquidity {
  /** Average close × volume of the last 20 sessions, rupiah. */
  avgValue20: number | null;
  zeroVolumeDays: number;
}

export function liquidityOf(bars: OHLCVBar[], n = 20): Liquidity {
  const w = bars.slice(-n);
  if (w.length === 0) return { avgValue20: null, zeroVolumeDays: 0 };
  return { avgValue20: avg(w.map((b) => b.close * Math.max(0, b.volume))), zeroVolumeDays: w.filter((b) => !(b.volume > 0)).length };
}

/** Last volume ÷ average volume of the PRIOR `n` sessions (the last bar is not part of its own baseline). */
export function relVolume(bars: OHLCVBar[], idx = bars.length - 1, n = BREAKOUT_LOOKBACK): number | null {
  const prior = bars.slice(Math.max(0, idx - n), idx).map((b) => b.volume);
  const a = avg(prior);
  return prior.length >= Math.min(n, 10) && a > 0 ? bars[idx].volume / a : null;
}

// ─── Pivots ─────────────────────────────────────────────────────────────────────

export interface Pivot { index: number; price: number }

/**
 * Swing highs / lows confirmed by `k` bars on each side. A pivot at index i needs bars i+1..i+k to exist, so
 * the last k bars of the series are never pivots — appending future bars can add pivots but never changes
 * what was known at an earlier bar.
 */
export function swingPivots(bars: OHLCVBar[], k = 2): { highs: Pivot[]; lows: Pivot[] } {
  const highs: Pivot[] = [];
  const lows: Pivot[] = [];
  for (let i = k; i < bars.length - k; i++) {
    let isH = true;
    let isL = true;
    for (let j = i - k; j <= i + k; j++) {
      if (j === i) continue;
      // Strict on the left, non-strict on the right: a flat top is pivoted once, at its first bar.
      if (j < i ? bars[j].high >= bars[i].high : bars[j].high > bars[i].high) isH = false;
      if (j < i ? bars[j].low <= bars[i].low : bars[j].low < bars[i].low) isL = false;
    }
    if (isH) highs.push({ index: i, price: bars[i].high });
    if (isL) lows.push({ index: i, price: bars[i].low });
  }
  return { highs, lows };
}

// ─── Costs ──────────────────────────────────────────────────────────────────────

export interface CostModel {
  /** Broker buy fee, %. */
  buyFeePct: number;
  /** Broker sell fee incl. 0,1% final income tax, %. */
  sellFeePct: number;
  /** Slippage per side, % — never less than one IDX tick. */
  slippagePct: number;
}

/** Typical retail IDX online-broker costs. */
export const IDX_COSTS: CostModel = { buyFeePct: 0.15, sellFeePct: 0.25, slippagePct: 0.1 };

const slip = (price: number, c: CostModel) => Math.max((price * c.slippagePct) / 100, idxTickSize(price));

/** Net reward & risk per share for a long, after fees and slippage on both legs. */
export function netRiskReward(entry: number, sl: number, target: number, c: CostModel = IDX_COSTS): { rr: number | null; rewardPct: number; riskPct: number } {
  const buy = (entry + slip(entry, c)) * (1 + c.buyFeePct / 100);
  const sellAt = (p: number) => (p - slip(p, c)) * (1 - c.sellFeePct / 100);
  const reward = sellAt(target) - buy;
  const risk = buy - sellAt(sl);
  return { rr: risk > 0 && reward > 0 ? reward / risk : reward <= 0 ? 0 : null, rewardPct: (reward / buy) * 100, riskPct: (risk / buy) * 100 };
}

// ─── Setups ─────────────────────────────────────────────────────────────────────

export type SetupType = 'TREND' | 'BREAKOUT' | 'RETEST' | 'PULLBACK' | 'CONSOLIDATION';
/**
 * TRIGGERED = entry trigger confirmed on the last closed candle. PENDING = setup forming, waiting for its trigger.
 * PRESENT = context only (trend). INVALID = it was attempted and failed (e.g. low-volume / failed breakout).
 * ABSENT = the data does not show it.
 */
export type SetupState = 'TRIGGERED' | 'PENDING' | 'PRESENT' | 'INVALID' | 'ABSENT';

export interface SetupEval {
  type: SetupType;
  state: SetupState;
  /** What has to be true for the setup to exist / activate. */
  activation: string;
  /** Price that must be closed above (breakout) or the zone to buy in (pullback / retest). */
  triggerPrice: number | null;
  zoneLow: number | null;
  zoneHigh: number | null;
  /** Close below this invalidates the setup. */
  invalidationPrice: number | null;
  invalidation: string;
  /** Structural low the SL is placed under (before the ATR buffer). Null = not known yet. */
  structuralLow: number | null;
  /** Key level (breakout / range high). */
  level: number | null;
  /** Measured move target (level + base height), if the pattern defines one. */
  measuredMove: number | null;
  reason: string;
  /** Key prices with their distinct roles (breakout level ≠ invalidation ≠ SL basis). */
  levels?: SetupLevel[];
  /** Exactly which candle's volume the setup requires. */
  volumeRule?: string;
  breakoutDate?: string;
  breakoutRvol?: number;
  /** Lowest low since the breakout (retest only). */
  retestLow?: number | null;
}

export interface SetupLevel {
  price: number;
  role: 'BREAKOUT' | 'ZONE_TOP' | 'INVALIDATION' | 'RETEST_LOW';
  label: string;
}

export interface SetupContext {
  bars: OHLCVBar[];
  atr: number;
  ema9: number | null;
  ema20: number;
  ema50: number;
  /** Trend read from the engine (EMA order + HH/HL). */
  trendBullish: boolean;
}

const zonePctOf = (atr: number, price: number) => Math.min(MAX_ZONE_PCT, Math.max(BREAKOUT_ZONE_PCT, (0.5 * atr / price) * 100));
const absent = (type: SetupType, activation: string, reason: string): SetupEval => ({
  type, state: 'ABSENT', activation, triggerPrice: null, zoneLow: null, zoneHigh: null, invalidationPrice: null,
  invalidation: '–', structuralLow: null, level: null, measuredMove: null, reason,
});

/** Breakout of the prior-20-session high, judged on the last candle's CLOSE. */
export function detectBreakout(c: SetupContext): SetupEval {
  const { bars, atr } = c;
  const last = bars[bars.length - 1];
  const prior = bars.slice(-(BREAKOUT_LOOKBACK + 1), -1);
  const R = Math.max(...prior.map((b) => b.high));
  const baseLow = Math.min(...prior.map((b) => b.low));
  const zp = zonePctOf(atr, R);
  const zoneHigh = R * (1 + zp / 100);
  const rv = relVolume(bars);
  const strong = last.close > last.open && last.close >= (last.high + last.low) / 2;
  const activation = `CLOSE di atas high ${BREAKOUT_LOOKBACK} sesi ${rp(R)} dengan RVOL ≥ ${BREAKOUT_RVOL}× dan candle hijau kuat (close di paruh atas)`;
  const common = {
    type: 'BREAKOUT' as const, activation, triggerPrice: R, zoneLow: R, zoneHigh, invalidationPrice: R,
    invalidation: `Close kembali di bawah ${rp(R)} (breakout gagal)`, structuralLow: R, level: R, measuredMove: R + (R - baseLow),
  };
  if (last.close > R) {
    if (last.close > zoneHigh) {
      return { ...common, state: 'PRESENT', reason: `Breakout ${rp(R)} sudah terjadi, tapi close +${r1(pct(last.close, R))}% di atas level (zona maks +${r1(zp)}%) — tunggu retest` };
    }
    if (rv == null || rv < BREAKOUT_RVOL || !strong) {
      return { ...common, state: 'INVALID', reason: `Close di atas ${rp(R)} tapi ${rv == null || rv < BREAKOUT_RVOL ? `RVOL ${rv == null ? 'N/A' : r1(rv)}× < ${BREAKOUT_RVOL}×` : 'candle lemah (close di paruh bawah / merah)'} — breakout belum terkonfirmasi` };
    }
    return { ...common, state: 'TRIGGERED', reason: `Close ${rp(last.close)} di atas ${rp(R)} dengan RVOL ${r1(rv)}× — breakout terkonfirmasi, masih di zona entry` };
  }
  const gap = pct(R, last.close);
  const near = Math.max(NEAR_BREAKOUT_PCT, (1.5 * atr / last.close) * 100);
  if (gap <= near) {
    return { ...common, state: 'PENDING', reason: gap < 0.05 ? `Close tepat di resistance ${rp(R)} — belum close di atasnya` : `Harga ${r1(gap)}% di bawah resistance ${rp(R)} — breakout belum terjadi` };
  }
  return { ...absent('BREAKOUT', activation, `Resistance ${rp(R)} masih +${r1(gap)}% dari harga`), level: R };
}

/**
 * Breakout-retest rules (configurable):
 *   • Level R = highest high of the 20 COMPLETED sessions before the breakout bar.
 *   • Breakout bar = a CLOSE above R with RVOL ≥ breakoutRvol, where RVOL = breakout-bar volume ÷ average of the
 *     20 sessions before it. Volume is required AT THE BREAKOUT, not at the retest.
 *   • Retest = the lowest low since the breakout comes within R + testToleranceAtr × ATR.
 *   • Retest volume: no red candle after the breakout may trade ≥ the breakout bar's volume (supply must dry up).
 *   • Confirmation = the LAST candle (already in the data at analysis time) is green, closes above R and above the
 *     previous close, still inside the entry zone.
 *   • Invalidation = any close below floorTick(R − invalidationAtr × ATR) → setup failed; wait for a new structure.
 * Only bars up to the analysed candle are read — nothing after it.
 */
export const RETEST_RULES = { maxAge: RETEST_MAX_AGE, breakoutRvol: BREAKOUT_RVOL, testToleranceAtr: 0.5, invalidationAtr: 0.25 } as const;

/** Largest valid IDX price ≤ p — an invalidation shown as "Rp 350" is checked against exactly Rp 350. */
export function floorToTick(p: number): number {
  const t = idxTickSize(p);
  return Math.floor(p / t + 1e-9) * t;
}

/** Breakout-retest: a volume breakout within the last 8 sessions, then price back at the level and holding. */
export function detectRetest(c: SetupContext, rules: typeof RETEST_RULES = RETEST_RULES): SetupEval {
  const { bars, atr } = c;
  const n = bars.length;
  const activation = `Breakout (close di atas level) dengan RVOL ≥ ${r1(rules.breakoutRvol)}× pada candle breakout dalam ${rules.maxAge} sesi terakhir, `
    + `harga menguji level (≤ level + ${r1(rules.testToleranceAtr)}× ATR) tanpa volume jual ≥ volume breakout, lalu candle hijau close di atas level`;
  // Most recent breakout bar j — same rule as detectBreakout: close > prior-20 high on RVOL ≥ breakoutRvol.
  for (let j = n - 1; j >= Math.max(BREAKOUT_LOOKBACK, n - rules.maxAge); j--) {
    const prior = bars.slice(j - BREAKOUT_LOOKBACK, j);
    const R = Math.max(...prior.map((b) => b.high));
    const rv = relVolume(bars, j);
    if (!(bars[j].close > R && rv != null && rv >= rules.breakoutRvol)) continue;
    const brk = bars[j];
    const baseLow = Math.min(...prior.map((b) => b.low));
    const zp = zonePctOf(atr, R);
    const zoneHigh = R * (1 + zp / 100);
    const inval = floorToTick(R - rules.invalidationAtr * atr);
    const after = bars.slice(j + 1);
    const last = bars[n - 1];
    const prev = bars[n - 2];
    const volumeRule = `Volume diukur di candle breakout ${brk.date}: RVOL ${r1(rv)}× (vs rata-rata 20 sesi sebelum breakout). `
      + 'Saat retest: tidak boleh ada candle merah bervolume ≥ volume breakout. Hanya candle s/d tanggal analisa yang dipakai.';
    const levels: SetupLevel[] = [
      { price: R, role: 'BREAKOUT', label: `Level breakout (high 20 sesi sebelum ${brk.date}) = batas bawah zona entry & level yang harus ditutup di atasnya` },
      { price: zoneHigh, role: 'ZONE_TOP', label: `Batas atas zona entry (level + ${r1(zp)}%) — di atasnya = mengejar` },
      { price: inval, role: 'INVALIDATION', label: `Invalidasi setup: close < level − ${r1(rules.invalidationAtr)}× ATR → breakout gagal` },
    ];
    const common = {
      type: 'RETEST' as const, activation, triggerPrice: R, zoneLow: R, zoneHigh, level: R, measuredMove: R + (R - baseLow),
      invalidationPrice: inval, invalidation: `Close di bawah ${rp(inval)} (level breakout ${rp(R)} gagal jadi support)`,
      volumeRule, breakoutDate: brk.date, breakoutRvol: rv,
    };
    const broke = after.find((b) => b.close < inval);
    if (broke) {
      return {
        ...common, state: 'INVALID', structuralLow: null, levels, retestLow: null,
        reason: `Breakout ${rp(R)} gagal — close ${rp(broke.close)} (${broke.date}) di bawah invalidasi ${rp(inval)}; tunggu struktur baru`,
      };
    }
    if (after.length === 0) {
      return { ...common, state: 'PENDING', structuralLow: R, levels, retestLow: null, reason: `Breakout ${rp(R)} baru terjadi — tunggu retest ke ${rp(R)}–${rp(zoneHigh)}` };
    }
    const retestLow = Math.min(...after.map((b) => b.low));
    const tested = retestLow <= R + rules.testToleranceAtr * atr;
    const heavySupply = after.some((b) => b.close < b.open && b.volume >= brk.volume);
    const confirmed = last.close > R && last.close <= zoneHigh && last.close > last.open && last.close > prev.close;
    const withLow = tested ? [...levels, { price: retestLow, role: 'RETEST_LOW' as const, label: 'Low retest sejak breakout — dasar SL struktural (dikurangi buffer 0,5× ATR)' }] : levels;
    const structuralLow = tested ? Math.min(retestLow, R) : R;
    if (tested && confirmed && !heavySupply) {
      return { ...common, state: 'TRIGGERED', structuralLow, levels: withLow, retestLow, reason: `Retest ${rp(R)} bertahan (low ${rp(retestLow)}) dan candle hijau close ${rp(last.close)}` };
    }
    return {
      ...common, state: 'PENDING', structuralLow, levels: withLow, retestLow: tested ? retestLow : null,
      reason: !tested ? `Breakout ${rp(R)} sudah terjadi, harga belum retest (close ${rp(last.close)})`
        : heavySupply ? `Retest ${rp(R)} disertai candle merah bervolume ≥ volume breakout — tekanan jual belum reda`
          : last.close > zoneHigh ? `Retest ${rp(R)} sempat bertahan (low ${rp(retestLow)}), tapi harga sudah memantul ke ${rp(last.close)} — di luar zona, tunggu retest berikutnya`
            : last.close <= R ? `Close ${rp(last.close)} di bawah level breakout ${rp(R)} (masih di atas invalidasi ${rp(inval)}) — retest belum terkonfirmasi; butuh candle hijau close di atas ${rp(R)}`
              : `Level ${rp(R)} sedang diuji — tunggu candle hijau yang close di atas close sebelumnya`,
    };
  }
  return absent('RETEST', activation, `Tidak ada breakout bervolume dalam ${rules.maxAge} sesi terakhir`);
}

/** Pullback in a bullish trend into the EMA 9–20 zone on light volume, confirmed by a bounce candle. */
export function detectPullback(c: SetupContext): SetupEval {
  const { bars, atr, ema9, ema20, trendBullish } = c;
  const n = bars.length;
  const last = bars[n - 1];
  const prev = bars[n - 2];
  const zoneLow = ema20 - 0.25 * atr;
  const zoneHigh = Math.min(ema20 + atr, Math.max(ema20 + 0.5 * atr, ema9 ?? 0));
  const activation = `Tren naik, harga turun ke zona EMA 9–20 (${rp(zoneLow)}–${rp(zoneHigh)}) dengan volume mengecil, lalu candle pantulan hijau`;
  const common = {
    type: 'PULLBACK' as const, activation, triggerPrice: null, zoneLow, zoneHigh, level: ema20, measuredMove: null,
    invalidationPrice: zoneLow - 0.5 * atr, invalidation: `Close di bawah ${rp(zoneLow - 0.5 * atr)} (EMA 20 jebol)`,
  };
  if (!trendBullish) return { ...absent('PULLBACK', activation, 'Tren belum naik — pullback bukan setup continuation'), zoneLow, zoneHigh };
  const recent = bars.slice(-3);
  const touched = Math.min(...recent.map((b) => b.low)) <= zoneHigh;
  const swingLow = Math.min(...bars.slice(-5).map((b) => b.low));
  const priorAvgVol = avg(bars.slice(-25, -5).map((b) => b.volume));
  const dipBars = bars.slice(-5, -1).filter((b) => b.close < b.open);
  const lightDip = priorAvgVol > 0 && (dipBars.length === 0 || avg(dipBars.map((b) => b.volume)) <= 1.1 * priorAvgVol);
  const bounce = last.close > last.open && last.close > prev.close && last.close >= (last.high + last.low) / 2;
  if (last.close < zoneLow - 0.5 * atr) {
    return { ...common, state: 'INVALID', structuralLow: null, reason: `Close ${rp(last.close)} sudah di bawah zona EMA 20 — pullback berubah jadi breakdown` };
  }
  if (touched && bounce && lightDip && last.close <= zoneHigh + 0.5 * atr) {
    return { ...common, state: 'TRIGGERED', structuralLow: swingLow, reason: `Pullback menyentuh zona EMA (low ${rp(swingLow)}) dengan volume turun, candle pantulan close ${rp(last.close)}` };
  }
  if (touched) {
    return {
      ...common, state: 'PENDING', structuralLow: swingLow, triggerPrice: last.high,
      reason: !lightDip ? 'Harga di zona EMA, tapi volume jual saat turun masih besar' : `Harga di zona EMA — tunggu candle hijau close di atas ${rp(last.high)}`,
    };
  }
  return { ...common, state: 'PENDING', structuralLow: null, reason: `Harga ${r1(pct(last.close, ema20))}% di atas EMA 20 — tunggu pullback ke zona EMA` };
}

/** A tight, defined range over the 10 sessions before the last bar. */
export function detectConsolidation(c: SetupContext): SetupEval {
  const { bars, atr } = c;
  const w = bars.slice(-11, -1);
  const last = bars[bars.length - 1];
  const hi = Math.max(...w.map((b) => b.high));
  const lo = Math.min(...w.map((b) => b.low));
  const width = pct(hi, lo);
  const maxWidth = Math.max(10, (3 * atr / last.close) * 100);
  const activation = `Range 10 sesi selebar ≤ ${r1(maxWidth)}% (maks(10%, 3× ATR)), lalu CLOSE di atas range high dengan RVOL ≥ ${BREAKOUT_RVOL}×`;
  if (width > maxWidth) return absent('CONSOLIDATION', activation, `Range 10 sesi ${r1(width)}% — terlalu lebar untuk konsolidasi`);
  const common = {
    type: 'CONSOLIDATION' as const, activation, triggerPrice: hi, zoneLow: hi, zoneHigh: hi * (1 + zonePctOf(atr, hi) / 100),
    invalidationPrice: lo, invalidation: `Close di bawah range low ${rp(lo)}`, structuralLow: lo, level: hi, measuredMove: hi + (hi - lo),
  };
  if (last.close < lo) return { ...common, state: 'INVALID', reason: `Close ${rp(last.close)} jebol range low ${rp(lo)}` };
  if (last.close > hi) return { ...common, state: 'PRESENT', reason: `Close keluar dari range ${rp(lo)}–${rp(hi)} (dinilai sebagai breakout)` };
  return { ...common, state: 'PENDING', reason: `Konsolidasi ${rp(lo)}–${rp(hi)} (${r1(width)}%) — tunggu close di atas ${rp(hi)}` };
}
