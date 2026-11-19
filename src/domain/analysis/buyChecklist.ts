/**
 * buyChecklist.ts
 *
 * "Kapan waktu beli" quick checklist (docs/features_checklist_buy.md), rule-based and data-only:
 *  A. 6 syarat wajib (one failure ⇒ the decision can never be BELI)
 *  B. Skenario beli: A pullback · B breakout · C rebound oversold
 *  C. 5 konfirmasi tambahan (min 2)
 *  → BELI BERTAHAP / WATCHLIST / JANGAN BELI + staged trading plan.
 *
 * Rule 1 of the doc ("jangan mengarang data") is enforced structurally: every value that can't be
 * computed from the inputs is `null` and every check that depends on it reports TIDAK CUKUP DATA.
 */

import { atr } from '@/domain/indicators/atr';
import { macd } from '@/domain/indicators/macd';
import { closes, lastValid, sma } from '@/domain/indicators/movingAverages';
import { cci, cmo, mfi, stochasticSlow, williamsR } from '@/domain/indicators/oscillators';
import { rsi } from '@/domain/indicators/rsi';
import { FundamentalDetail } from '@/domain/models/Fundamentals';
import { OHLCVBar } from '@/domain/models/History';
import { StockNewsItem } from '@/domain/models/News';
import { StockSummary } from '@/domain/models/Stock';
import { StockAnalysis } from '@/domain/models/StockAnalysis';
import { idxTickSize, roundToTick } from './idxTick';

export type CheckStatus = 'LOLOS' | 'TIDAK' | 'TIDAK CUKUP DATA';
export type ScenarioStatus = 'COCOK' | 'TIDAK COCOK' | 'TIDAK CUKUP DATA';
export type ConfirmStatus = 'YA' | 'TIDAK' | 'TIDAK CUKUP DATA';
export type BuyDecision = 'BELI BERTAHAP' | 'WATCHLIST' | 'JANGAN BELI';
export type ScenarioId = 'A' | 'B' | 'C';

export interface ChecklistRow<S extends string> {
  key: string;
  label: string;
  status: S;
  evidence: string;
  note: string;
}

export interface ScenarioCriterion {
  label: string;
  /** null = not computable from the available data. */
  ok: boolean | null;
  detail: string;
}

export interface PlanLevels {
  entryLow: number;
  entryHigh: number;
  sl: number;
  slBasis: string;
  tp1: number | null;
  tp1Basis: string | null;
  tp2: number | null;
  tp2Basis: string | null;
  source: string;
}

export interface ScenarioRow {
  id: ScenarioId;
  name: string;
  status: ScenarioStatus;
  criteria: ScenarioCriterion[];
  passed: number;
  evidence: string;
  note: string;
  plan: PlanLevels | null;
}

export interface DataPoint {
  label: string;
  /** null ⇒ shown as TIDAK CUKUP DATA. */
  value: string | null;
  /** Inferred rather than read straight from data (doc rule 2). */
  assumption?: boolean;
}

export interface BuyChecklistPlan extends PlanLevels {
  /** Conservative R:R to TP1, measured from the top of the entry zone. */
  riskReward: number | null;
  riskPerShare: number;
  riskPct: number;
  triggers: string[];
}

export interface BuyChecklistReport {
  asOf: string;
  lastBarDate: string | null;
  price: number;
  dataOk: boolean;
  data: DataPoint[];
  missing: string[];
  mandatory: ChecklistRow<CheckStatus>[];
  mandatoryPassed: number;
  scenarios: ScenarioRow[];
  selected: ScenarioId | null;
  confirmations: ChecklistRow<ConfirmStatus>[];
  confirmCount: number;
  riskReward: number | null;
  decision: BuyDecision;
  reasons: string[];
  plan: BuyChecklistPlan | null;
}

export interface BuyChecklistInput {
  summary: StockSummary;
  bars: OHLCVBar[];
  /** Longer daily history (2y) so MA200 can be computed. */
  longBars?: OHLCVBar[];
  analysis: StockAnalysis;
  fundamentals: FundamentalDetail | null;
  news: StockNewsItem[];
  newsLoading: boolean;
  ihsgBars: OHLCVBar[];
  asOf: Date;
}

export const SCENARIO_NAME: Record<ScenarioId, string> = {
  A: 'Pullback ke support / tren naik',
  B: 'Breakout',
  C: 'Rebound dari oversold',
};

const MIN_RR = 2;
const MIN_CONFIRMATIONS = 2;
const NEWS_WINDOW_DAYS = 30;
const SEVERE_NEWS = /suspen|delist|gagal bayar|default|pkpu|pailit|bangkrut|fraud|manipulasi|tersangka|going concern/i;
const CATALYST_NEWS = /kontrak|buyback|buy back|dividen|laba (naik|melonjak|tumbuh)|akuisisi|ekspansi|proyek baru/i;

// ── small helpers ────────────────────────────────────────────────────────────
const fin = (n: number | null | undefined): number | null => (n != null && Number.isFinite(n) ? n : null);
const posN = (n: number | null | undefined): number | null => (n != null && Number.isFinite(n) && n > 0 ? n : null);
const at = (s: number[], back = 0): number | null => fin(s[s.length - 1 - back]);
const id = (n: number, dec = 0) => n.toLocaleString('id-ID', { minimumFractionDigits: dec, maximumFractionDigits: dec });
const rp = (n: number | null) => (n == null ? 'N/A' : `Rp${id(n)}`);
const pct = (n: number | null, dec = 1) => (n == null ? 'N/A' : `${n >= 0 ? '+' : ''}${id(n, dec)}%`);
const floorTick = (p: number) => {
  if (!Number.isFinite(p) || p <= 0) return 0;
  const t = idxTickSize(p);
  return Math.floor(p / t) * t;
};
const smaAt = (values: number[], period: number, back = 0) => (values.length >= period + back ? at(sma(values, period), back) : null);
const minOfLast = (s: number[], n: number) => {
  const xs = s.slice(-n).filter(Number.isFinite);
  return xs.length ? Math.min(...xs) : null;
};

// ── candlestick patterns (bullish only) ──────────────────────────────────────
const body = (b: OHLCVBar) => Math.abs(b.close - b.open);
const range = (b: OHLCVBar) => b.high - b.low;
const isGreen = (b: OHLCVBar) => b.close > b.open;
const isRed = (b: OHLCVBar) => b.close < b.open;

function isHammer(b: OHLCVBar): boolean {
  const r = range(b);
  if (r <= 0) return false;
  const lower = Math.min(b.open, b.close) - b.low;
  const upper = b.high - Math.max(b.open, b.close);
  return lower >= 2 * body(b) && lower >= 0.55 * r && upper <= 0.25 * r;
}
function isBullishEngulfing(prev: OHLCVBar, cur: OHLCVBar): boolean {
  return isRed(prev) && isGreen(cur) && cur.open <= prev.close && cur.close >= prev.open && body(cur) > body(prev);
}
function isPiercing(prev: OHLCVBar, cur: OHLCVBar): boolean {
  const mid = (prev.open + prev.close) / 2;
  return isRed(prev) && body(prev) >= 0.5 * range(prev) && isGreen(cur) && cur.open <= prev.close && cur.close > mid && cur.close < prev.open;
}
function isMorningStar(a: OHLCVBar, b: OHLCVBar, c: OHLCVBar): boolean {
  const mid = (a.open + a.close) / 2;
  return isRed(a) && body(a) >= 0.5 * range(a) && body(b) <= 0.35 * body(a) && isGreen(c) && c.close > mid;
}

/** Bullish reversal patterns completed on the bar at `i` (from the end: 0 = last bar). */
function bullishPatternsAt(bars: OHLCVBar[], back: number): string[] {
  const i = bars.length - 1 - back;
  if (i < 0) return [];
  const out: string[] = [];
  const cur = bars[i];
  const prev = bars[i - 1];
  const prev2 = bars[i - 2];
  if (isHammer(cur)) out.push('Hammer');
  if (prev && isBullishEngulfing(prev, cur)) out.push('Bullish Engulfing');
  if (prev && isPiercing(prev, cur)) out.push('Piercing Line');
  if (prev && prev2 && isMorningStar(prev2, prev, cur)) out.push('Morning Star');
  return out;
}

// ── builder ──────────────────────────────────────────────────────────────────
export function buildBuyChecklist(input: BuyChecklistInput): BuyChecklistReport {
  const { summary, bars, analysis, fundamentals, news, newsLoading, ihsgBars, asOf } = input;
  const price = summary.lastClose;
  const n = bars.length;
  const last = bars[n - 1];
  const prev = bars[n - 2];
  const hist = input.longBars && input.longBars.length > n ? input.longBars : bars;
  const histCloses = closes(hist);
  const dataOk = n >= 30 && price > 0;

  // ── indicators ──
  const ma20 = smaAt(histCloses, 20);
  const ma20Prev5 = smaAt(histCloses, 20, 5);
  const ma50 = smaAt(histCloses, 50);
  const ma50Prev10 = smaAt(histCloses, 50, 10);
  const ma200 = smaAt(histCloses, 200);
  const atr14 = posN(lastValid(atr(bars, 14)));
  const rsiS = rsi(bars, 14);
  const rsiNow = at(rsiS);
  const rsiPrev = at(rsiS, 1);
  const stoch = stochasticSlow(bars, 14, 3, 3);
  const mfiS = mfi(bars, 14);
  const cciS = cci(bars, 20);
  const wrS = williamsR(bars, 14);
  const cmoS = cmo(bars, 14);
  const macdS = macd(bars);
  const stochK = at(stoch.k);
  const stochD = at(stoch.d);
  const mfiNow = at(mfiS);
  const cciNow = at(cciS);
  const wrNow = at(wrS);
  const rvol = posN(analysis.volume.relativeVolume);
  const volMa20 = posN(analysis.volume.volumeMa20);
  const change1M = fin(summary.percentChange1M);
  const ma20Slope5 = ma20 != null && ma20Prev5 != null ? ((ma20 - ma20Prev5) / ma20Prev5) * 100 : null;

  const patternsLast = bullishPatternsAt(bars, 0);
  const patternsRecent = [...new Set([...patternsLast, ...bullishPatternsAt(bars, 1)])];
  const lastPatternLabel = patternsLast.length
    ? patternsLast.join(', ')
    : analysis.priceAction.pattern !== 'none' ? analysis.priceAction.patternLabel : last ? `Tidak ada pola khusus (candle ${isGreen(last) ? 'hijau' : isRed(last) ? 'merah' : 'doji'})` : null;

  // ── support / resistance ──
  const s1 = posN(analysis.supportResistance.supports[0]?.price);
  const resistancesAbove = (p: number) => analysis.supportResistance.resistances.map((r) => r.price).filter((x) => x > p * 1.005).sort((a, b) => a - b);
  const r1 = resistancesAbove(price)[0] ?? null;
  // 20-bar high before the last candle = the "clear resistance" for the breakout scenario.
  const prior20High = n >= 21 ? Math.max(...bars.slice(n - 21, n - 1).map((b) => b.high)) : null;
  const brokeOut = prior20High != null && price > prior20High;

  const supportCandidates: Array<{ price: number; name: string }> = [];
  if (s1 != null) supportCandidates.push({ price: s1, name: 'Support S1' });
  if (ma20 != null && ma20 < price) supportCandidates.push({ price: ma20, name: 'MA20' });
  if (ma50 != null && ma50 < price) supportCandidates.push({ price: ma50, name: 'MA50' });
  if (brokeOut && prior20High != null) supportCandidates.push({ price: prior20High, name: 'resistance 20 hari yang ditembus' });
  const nearestSupport = supportCandidates.length ? supportCandidates.reduce((a, b) => (b.price > a.price ? b : a)) : null;

  // ── trend ──
  let trendLabel: string | null = null;
  if (ma50 != null && ma20 != null) {
    trendLabel = price > ma50 && ma20 > ma50 ? 'Naik' : price < ma50 && ma20 < ma50 ? 'Turun' : 'Sideways';
  }
  const sharpDowntrend = ma20 != null && ma50 != null
    ? price < ma20 && price < ma50 && ma20 < ma50 && ((ma20Slope5 != null && ma20Slope5 <= -2.5) || (change1M != null && change1M <= -10))
    : null;

  // ── news & fundamentals risk ──
  const newsAge = (x: StockNewsItem) => (x.publishedAtMs ? (asOf.getTime() - x.publishedAtMs) / 86_400_000 : null);
  const isRecent = (x: StockNewsItem) => {
    const d = newsAge(x);
    return d != null ? d <= NEWS_WINDOW_DAYS : x.ageBucket === 'CURRENT' || x.ageBucket === 'RECENT';
  };
  const ownNews = news.filter((x) => x.relevance == null || x.relevance === 'DIRECT' || x.relevance === 'INDIRECT');
  const severeNews = ownNews.filter((x) => isRecent(x) && (SEVERE_NEWS.test(`${x.title} ${x.snippet}`) || (x.sentiment === 'bearish' && x.impactScore >= 4)));
  const extremeLoss = fundamentals?.netMargin != null && fundamentals.earningsGrowth != null && fundamentals.netMargin < 0 && fundamentals.earningsGrowth <= -50;

  let newsStatus: CheckStatus;
  let newsEvidence: string;
  if (newsLoading) {
    newsStatus = 'TIDAK CUKUP DATA';
    newsEvidence = 'Berita masih dimuat.';
  } else if (severeNews.length > 0 || extremeLoss) {
    newsStatus = 'TIDAK';
    newsEvidence = [
      ...severeNews.slice(0, 2).map((x) => `“${x.title}”`),
      extremeLoss ? `Rugi bersih (margin ${pct(fundamentals!.netMargin)}) dengan laba YoY ${pct(fundamentals!.earningsGrowth)}` : null,
    ].filter(Boolean).join(' · ');
  } else if (news.length === 0) {
    newsStatus = 'TIDAK CUKUP DATA';
    newsEvidence = 'Tidak ada berita dari sumber data — tidak bisa memastikan tidak ada berita negatif.';
  } else {
    newsStatus = 'LOLOS';
    newsEvidence = `${news.length} berita dicek (${ownNews.filter(isRecent).length} terkait & ≤${NEWS_WINDOW_DAYS} hari): tidak ada suspend/delisting/gagal bayar/sentimen sangat negatif.`;
  }

  // ── scenario A: pullback ──
  const scenarioA = ((): ScenarioRow => {
    const crit: ScenarioCriterion[] = [];
    const trendUp = ma20 != null && ma50 != null && ma50Prev10 != null ? price > ma50 && ma20 > ma50 && ma50 > ma50Prev10 : null;
    crit.push({ label: 'Tren jangka menengah naik', ok: trendUp, detail: ma50 != null ? `Harga ${rp(price)} vs MA20 ${rp(ma20)} / MA50 ${rp(ma50)}${ma50Prev10 != null ? `, MA50 ${ma50 > ma50Prev10 ? 'naik' : 'turun'} 10 sesi` : ''}` : 'MA50 belum bisa dihitung' });

    const low3 = n >= 3 ? Math.min(...bars.slice(-3).map((b) => b.low)) : null;
    const high10 = n >= 10 ? Math.max(...bars.slice(-10).map((b) => b.high)) : null;
    const levels = [
      ma20 != null ? { price: ma20, name: 'MA20' } : null,
      ma50 != null ? { price: ma50, name: 'MA50' } : null,
      s1 != null ? { price: s1, name: 'Support S1' } : null,
    ].filter((x): x is { price: number; name: string } => x != null);
    const touched = low3 != null && high10 != null && high10 > price * 1.03
      ? levels.filter((l) => low3 <= l.price * 1.02 && price >= l.price * 0.98 && (price - l.price) / l.price <= 0.03).sort((a, b) => b.price - a.price)[0] ?? null
      : null;
    crit.push({
      label: 'Harga pullback ke support / MA penting',
      ok: low3 == null ? null : touched != null,
      detail: touched ? `Low 3 sesi ${rp(low3)} menyentuh ${touched.name} ${rp(touched.price)}` : high10 != null && high10 <= price * 1.03 ? 'Belum ada koreksi berarti dari high 10 sesi' : 'Harga tidak sedang di area support/MA',
    });

    const downBars = bars.slice(-5).filter((b, i, arr) => {
      const p = i === 0 ? bars[n - 6] : arr[i - 1];
      return p != null && b.close < p.close;
    });
    const downVolAvg = downBars.length ? downBars.reduce((s, b) => s + b.volume, 0) / downBars.length : null;
    crit.push({
      label: 'Volume jual mengecil saat pullback',
      ok: volMa20 == null ? null : downVolAvg != null && downVolAvg < volMa20 * 0.9,
      detail: downVolAvg != null && volMa20 != null ? `Rata-rata volume hari turun ${id(downVolAvg / volMa20, 2)}× MA20 volume` : 'Tidak ada hari turun dalam 5 sesi',
    });
    crit.push({ label: 'Bullish candlestick di support', ok: touched != null && patternsRecent.length > 0, detail: patternsRecent.length ? patternsRecent.join(', ') : 'Belum ada pola bullish' });
    crit.push({
      label: 'RSI/MFI tidak overbought',
      ok: rsiNow == null || mfiNow == null ? null : rsiNow < 70 && mfiNow < 80,
      detail: `RSI ${rsiNow != null ? id(rsiNow, 1) : 'N/A'} · MFI ${mfiNow != null ? id(mfiNow, 1) : 'N/A'}`,
    });

    const passed = crit.filter((c) => c.ok).length;
    const status: ScenarioStatus = trendUp == null ? 'TIDAK CUKUP DATA' : trendUp && touched && passed >= 4 ? 'COCOK' : 'TIDAK COCOK';
    let plan: PlanLevels | null = null;
    if (touched) {
      const buffer = atr14 != null ? 0.5 * atr14 : touched.price * 0.02;
      const sl = floorTick(touched.price - buffer);
      const tps = resistancesAbove(price);
      plan = {
        entryLow: roundToTick(Math.min(touched.price, price)), entryHigh: roundToTick(price),
        sl, slBasis: `${touched.name} ${rp(touched.price)} − ${atr14 != null ? '0,5 ATR' : '2%'}`,
        tp1: tps[0] ?? null, tp1Basis: tps[0] != null ? 'Resistance terdekat' : null,
        tp2: tps[1] ?? null, tp2Basis: tps[1] != null ? 'Resistance berikutnya' : null,
        source: 'Skenario A',
      };
    }
    return {
      id: 'A', name: SCENARIO_NAME.A, status, criteria: crit, passed,
      evidence: crit.filter((c) => c.ok).map((c) => c.label).join(' · ') || '–',
      note: status === 'COCOK' ? 'Entry dekat support dengan risiko terukur.' : touched ? 'Harga di support, tapi konfirmasi belum lengkap.' : 'Tunggu koreksi ke MA20/MA50/support dulu.',
      plan,
    };
  })();

  // ── scenario B: breakout ──
  const scenarioB = ((): ScenarioRow => {
    const crit: ScenarioCriterion[] = [];
    const H = prior20High;
    const pierced = H != null && last != null ? last.high > H : null;
    const closedAbove = H != null && last != null ? last.close > H && price > H : null;
    const sl = H != null ? floorTick(H - (atr14 != null ? 0.5 * atr14 : H * 0.02)) : null;
    const next = resistancesAbove(price);
    const roomOk = sl != null && next[0] != null ? next[0] - price >= MIN_RR * (price - sl) : null;
    crit.push({ label: 'Menembus resistensi jelas', ok: pierced, detail: H != null ? `High 20 sesi sebelumnya ${rp(H)} · high hari ini ${rp(last?.high ?? null)}` : 'Histori < 21 sesi' });
    crit.push({ label: 'Volume meningkat saat breakout', ok: rvol == null ? null : rvol >= 1.5, detail: rvol != null ? `RVOL ${id(rvol, 2)}× (syarat ≥ 1,5×)` : 'RVOL tidak tersedia' });
    crit.push({
      label: 'Close di atas resistensi (bukan intraday)',
      ok: closedAbove,
      detail: closedAbove ? `Close ${rp(last!.close)} > ${rp(H)}` : pierced ? 'Breakout hanya intraday — close kembali di bawah resistensi' : 'Belum menembus',
    });
    crit.push({
      label: 'Ada ruang ke target berikutnya',
      ok: closedAbove ? roomOk : false,
      detail: next[0] != null ? `Resistance berikutnya ${rp(next[0])} (${pct(((next[0] - price) / price) * 100)})` : 'Tidak ada resistance di atas dalam data (area harga tertinggi) — target tidak bisa diukur',
    });
    crit.push({ label: 'Stop loss di bawah resistensi yang ditembus', ok: closedAbove && sl != null ? sl < price : false, detail: sl != null ? `SL ${rp(sl)} (resistensi − ${atr14 != null ? '0,5 ATR' : '2%'})` : '–' });

    const passed = crit.filter((c) => c.ok).length;
    const status: ScenarioStatus = H == null ? 'TIDAK CUKUP DATA' : pierced && closedAbove && crit[1].ok && roomOk ? 'COCOK' : 'TIDAK COCOK';
    const plan: PlanLevels | null = closedAbove && H != null && sl != null ? {
      entryLow: roundToTick(H), entryHigh: roundToTick(price), sl, slBasis: `Di bawah resistensi yang ditembus ${rp(H)}`,
      tp1: next[0] ?? null, tp1Basis: next[0] != null ? 'Resistance berikutnya' : null,
      tp2: next[1] ?? null, tp2Basis: next[1] != null ? 'Resistance setelahnya' : null,
      source: 'Skenario B',
    } : null;
    return {
      id: 'B', name: SCENARIO_NAME.B, status, criteria: crit, passed,
      evidence: crit.filter((c) => c.ok).map((c) => c.label).join(' · ') || '–',
      note: status === 'COCOK' ? 'Entry di breakout atau saat retest resistensi lama.' : H != null ? `Trigger: close > ${rp(H)} dengan volume ≥ 1,5× rata-rata.` : 'Histori belum cukup.',
      plan,
    };
  })();

  // ── scenario C: oversold rebound ──
  const oversold = [
    { label: 'RSI < 30', v: minOfLast(rsiS, 3), ok: (v: number) => v < 30 },
    { label: 'Stoch < 20', v: minOfLast(stoch.k, 3), ok: (v: number) => v < 20 },
    { label: 'MFI < 20', v: minOfLast(mfiS, 3), ok: (v: number) => v < 20 },
    { label: 'Williams %R < −80', v: minOfLast(wrS, 3), ok: (v: number) => v < -80 },
    { label: 'CCI < −100', v: minOfLast(cciS, 3), ok: (v: number) => v < -100 },
    { label: 'CMO < −50', v: minOfLast(cmoS, 3), ok: (v: number) => v < -50 },
  ];
  const oversoldAvail = oversold.filter((o) => o.v != null);
  const oversoldHit = oversoldAvail.filter((o) => o.ok(o.v!));
  const scenarioC = ((): ScenarioRow => {
    const crit: ScenarioCriterion[] = [];
    crit.push({
      label: 'Min. 3 indikator oversold (3 sesi terakhir)',
      ok: oversoldAvail.length < 3 ? null : oversoldHit.length >= 3,
      detail: `${oversoldHit.length}/${oversoldAvail.length} terpenuhi${oversoldHit.length ? `: ${oversoldHit.map((o) => o.label).join(', ')}` : ''}`,
    });
    const reversal = patternsRecent.length > 0;
    crit.push({ label: 'Konfirmasi price action', ok: n >= 3 ? reversal : null, detail: reversal ? patternsRecent.join(', ') : 'Belum ada hammer / engulfing / morning star / piercing line' });
    const volUp = last && prev && rvol != null ? isGreen(last) && last.volume > prev.volume && rvol >= 1 : null;
    crit.push({ label: 'Volume mulai naik saat rebound', ok: volUp, detail: last && prev ? `Candle ${isGreen(last) ? 'hijau' : 'tidak hijau'}, volume ${last.volume > prev.volume ? 'naik' : 'turun'} vs kemarin, RVOL ${rvol != null ? id(rvol, 2) : 'N/A'}×` : '–' });
    crit.push({ label: 'Tidak ada berita negatif baru', ok: newsStatus === 'LOLOS' ? true : newsStatus === 'TIDAK' ? false : null, detail: newsEvidence });
    const low5 = n >= 5 ? Math.min(...bars.slice(-5).map((b) => b.low)) : null;
    crit.push({ label: 'Stop di bawah low terakhir', ok: low5 != null ? low5 < price : null, detail: low5 != null ? `Low 5 sesi ${rp(low5)}` : '–' });

    const passed = crit.filter((c) => c.ok).length;
    const status: ScenarioStatus = crit[0].ok == null ? 'TIDAK CUKUP DATA' : crit[0].ok && reversal && volUp && crit[3].ok !== false ? 'COCOK' : 'TIDAK COCOK';
    let plan: PlanLevels | null = null;
    if (low5 != null && low5 < price) {
      const sl = floorTick(low5 - (atr14 != null ? 0.25 * atr14 : low5 * 0.01));
      const ups = [ma20 != null && ma20 > price * 1.005 ? { p: roundToTick(ma20), b: 'MA20 (mean reversion)' } : null, ...resistancesAbove(price).map((p) => ({ p, b: 'Resistance' }))]
        .filter((x): x is { p: number; b: string } => x != null)
        .sort((a, b) => a.p - b.p);
      plan = {
        entryLow: roundToTick(price), entryHigh: roundToTick(price), sl, slBasis: `Di bawah low 5 sesi ${rp(low5)}`,
        tp1: ups[0]?.p ?? null, tp1Basis: ups[0]?.b ?? null, tp2: ups[1]?.p ?? null, tp2Basis: ups[1]?.b ?? null,
        source: 'Skenario C',
      };
    }
    return {
      id: 'C', name: SCENARIO_NAME.C, status, criteria: crit, passed,
      evidence: crit.filter((c) => c.ok).map((c) => c.label).join(' · ') || '–',
      note: status === 'COCOK' ? 'Rebound spekulatif — porsi kecil, stop ketat.' : oversoldHit.length >= 3 ? 'Oversold, tapi tunggu konfirmasi candle & volume.' : 'Belum oversold secara luas.',
      plan,
    };
  })();

  const scenarios = [scenarioA, scenarioB, scenarioC];
  const matched = scenarios.filter((s) => s.status === 'COCOK').sort((a, b) => b.passed - a.passed);
  const selected = matched[0] ?? null;

  // Plan used for syarat 4–6: the selected scenario's, else the app's bullish plan (labelled as such).
  const engine = analysis.tradingPlan.bullish;
  const enginePlan: PlanLevels | null = engine.validationErrors.length === 0 && engine.sl > 0 && engine.entry > engine.sl
    ? {
      entryLow: roundToTick(engine.entry), entryHigh: roundToTick(engine.entry),
      sl: engine.sl, slBasis: 'SL dari rencana bullish aplikasi',
      tp1: engine.tp1 > engine.entry ? engine.tp1 : null, tp1Basis: 'TP1 rencana aplikasi',
      tp2: engine.tp2 > engine.tp1 ? engine.tp2 : null, tp2Basis: 'TP2 rencana aplikasi',
      source: 'Rencana bullish aplikasi (belum ada skenario cocok)',
    }
    : null;
  const basePlan = selected?.plan ?? enginePlan;
  const riskPerShare = basePlan ? basePlan.entryHigh - basePlan.sl : 0;
  const riskReward = basePlan && basePlan.tp1 != null && riskPerShare > 0 ? (basePlan.tp1 - basePlan.entryHigh) / riskPerShare : null;

  // ── A. mandatory ──
  const mandatory: ChecklistRow<CheckStatus>[] = [];
  mandatory.push({
    key: 'trend', label: 'Tren utama tidak sedang downtrend tajam',
    status: sharpDowntrend == null ? 'TIDAK CUKUP DATA' : sharpDowntrend ? 'TIDAK' : 'LOLOS',
    evidence: ma50 != null ? `Harga ${rp(price)} · MA20 ${rp(ma20)} · MA50 ${rp(ma50)} · MA20 ${pct(ma20Slope5)}/5 sesi · 1M ${pct(change1M)}` : 'MA50 belum bisa dihitung',
    note: trendLabel ? `Tren ${trendLabel.toLowerCase()} (asumsi dari posisi MA)` : '',
  });
  mandatory.push({
    key: 'news', label: 'Tidak ada berita negatif besar', status: newsStatus, evidence: newsEvidence,
    note: 'Data insider & aksi korporasi resmi (KSEI/IDX) tidak tersedia — hanya dicek dari berita.',
  });
  const distAtr = nearestSupport && atr14 ? (price - nearestSupport.price) / atr14 : null;
  const distPct = nearestSupport ? ((price - nearestSupport.price) / nearestSupport.price) * 100 : null;
  const fomo = distAtr != null ? distAtr > 2.5 : distPct != null ? distPct > 8 : null;
  mandatory.push({
    key: 'fomo', label: 'Harga tidak loncat jauh dari support (FOMO)',
    status: fomo == null ? 'TIDAK CUKUP DATA' : fomo ? 'TIDAK' : 'LOLOS',
    evidence: nearestSupport ? `${pct(distPct)} di atas ${nearestSupport.name} ${rp(nearestSupport.price)}${distAtr != null ? ` (${id(distAtr, 1)}× ATR)` : ''}` : 'Tidak ada support di bawah harga',
    note: 'Batas: ≤ 2,5× ATR dari support terdekat.',
  });
  const slClear = basePlan != null && nearestSupport != null && basePlan.sl > 0 && basePlan.sl < basePlan.entryLow;
  mandatory.push({
    key: 'sl', label: 'Support terdekat & stop loss jelas',
    status: nearestSupport == null ? 'TIDAK CUKUP DATA' : slClear ? 'LOLOS' : 'TIDAK',
    evidence: basePlan ? `Support ${nearestSupport ? rp(nearestSupport.price) : 'N/A'} · SL ${rp(basePlan.sl)} (${basePlan.slBasis})` : 'Belum ada rencana dengan SL valid',
    note: basePlan?.source ?? '',
  });
  mandatory.push({
    key: 'rr', label: `Risk–reward minimal 1:${MIN_RR}`,
    status: riskReward == null ? 'TIDAK CUKUP DATA' : riskReward >= MIN_RR ? 'LOLOS' : 'TIDAK',
    evidence: riskReward != null && basePlan ? `Entry ${rp(basePlan.entryHigh)} → TP1 ${rp(basePlan.tp1)} vs SL ${rp(basePlan.sl)} = 1:${id(riskReward, 2)}` : basePlan ? 'Tidak ada target (resistance) di atas entry dalam data' : 'Belum ada rencana entry/SL',
    note: 'Konservatif: dari batas atas zona entry ke TP1.',
  });
  mandatory.push({
    key: 'staged', label: 'Ada rencana entry bertahap (tidak all-in)',
    status: basePlan ? 'LOLOS' : 'TIDAK',
    evidence: basePlan ? '50% di trigger, 50% setelah konfirmasi — lihat Rencana Trading' : 'Belum ada rencana entry',
    note: 'Diterapkan oleh rencana checklist ini.',
  });
  const mandatoryPassed = mandatory.filter((m) => m.status === 'LOLOS').length;

  // ── C. confirmations ──
  const confirmations: ChecklistRow<ConfirmStatus>[] = [];
  const volSupport = last && rvol != null ? (isGreen(last) && rvol >= 1.2) || (selected?.id === 'A' && scenarioA.criteria[2].ok === true) : null;
  confirmations.push({
    key: 'volume', label: 'Volume mendukung arah beli',
    status: volSupport == null ? 'TIDAK CUKUP DATA' : volSupport ? 'YA' : 'TIDAK',
    evidence: last && rvol != null ? `Candle ${isGreen(last) ? 'hijau' : 'tidak hijau'}, RVOL ${id(rvol, 2)}×${selected?.id === 'A' ? ` · ${scenarioA.criteria[2].detail}` : ''}` : 'RVOL tidak tersedia',
    note: '',
  });
  const hist3 = macdS.histogram.slice(-4);
  const macdCross = hist3.length === 4 && hist3.every(Number.isFinite) && hist3.slice(1).some((h, i) => hist3[i] <= 0 && h > 0);
  const rsiMin5 = minOfLast(rsiS, 5);
  const rsiFromOversold = rsiNow != null && rsiPrev != null && rsiMin5 != null && rsiMin5 < 35 && rsiNow > rsiPrev;
  confirmations.push({
    key: 'momentum', label: 'Momentum membaik (RSI naik dari oversold / MACD cross up)',
    status: rsiNow == null ? 'TIDAK CUKUP DATA' : rsiFromOversold || macdCross ? 'YA' : 'TIDAK',
    evidence: `RSI ${rsiPrev != null ? id(rsiPrev, 1) : 'N/A'} → ${rsiNow != null ? id(rsiNow, 1) : 'N/A'} (min 5 sesi ${rsiMin5 != null ? id(rsiMin5, 1) : 'N/A'}) · MACD ${macdCross ? 'cross up ≤ 3 sesi' : 'belum cross up baru'}`,
    note: '',
  });
  let rs: { stock: number; ihsg: number } | null = null;
  if (n >= 21 && ihsgBars.length >= 21) {
    const ih = ihsgBars;
    rs = { stock: (bars[n - 1].close / bars[n - 21].close - 1) * 100, ihsg: (ih[ih.length - 1].close / ih[ih.length - 21].close - 1) * 100 };
  }
  confirmations.push({
    key: 'rs', label: 'Relative strength lebih kuat dari IHSG/sektor',
    status: rs == null ? 'TIDAK CUKUP DATA' : rs.stock > rs.ihsg ? 'YA' : 'TIDAK',
    evidence: rs ? `20 sesi: saham ${pct(rs.stock)} vs IHSG ${pct(rs.ihsg)} (sektor tidak tersedia)` : 'Data IHSG belum tersedia',
    note: '',
  });
  const catalysts: string[] = [];
  if (fundamentals?.earningsGrowth != null && fundamentals.earningsGrowth > 0) catalysts.push(`Laba YoY ${pct(fundamentals.earningsGrowth)}`);
  const recentDiv = fundamentals?.dividendHistory?.find((d) => (asOf.getTime() - Date.parse(d.date)) / 86_400_000 <= 180);
  if (recentDiv) catalysts.push(`Dividen Rp${id(recentDiv.amount, 2)} (ex ${recentDiv.date})`);
  const goodNews = ownNews.filter((x) => isRecent(x) && x.sentiment === 'bullish' && (x.impactScore >= 3 || CATALYST_NEWS.test(`${x.title} ${x.snippet}`)));
  if (goodNews[0]) catalysts.push(`Berita: “${goodNews[0].title}”`);
  const catalystData = fundamentals != null || news.length > 0;
  confirmations.push({
    key: 'catalyst', label: 'Katalis jelas (laba, kontrak, dividen, buyback)',
    status: catalysts.length ? 'YA' : catalystData ? 'TIDAK' : 'TIDAK CUKUP DATA',
    evidence: catalysts.length ? catalysts.join(' · ') : catalystData ? 'Tidak ditemukan katalis positif baru' : 'Fundamental & berita belum tersedia',
    note: '',
  });
  const supportHeld = s1 != null && n >= 3 ? bars.slice(-3).every((b) => b.close > s1) : null;
  confirmations.push({
    key: 'support', label: 'Level support jelas & belum jebol',
    status: supportHeld == null ? 'TIDAK CUKUP DATA' : supportHeld ? 'YA' : 'TIDAK',
    evidence: s1 != null ? `S1 ${rp(s1)} · close 3 sesi terakhir ${supportHeld ? 'di atas' : 'pernah di bawah'} S1` : 'Support tidak terdeteksi',
    note: '',
  });
  const confirmCount = confirmations.filter((c) => c.status === 'YA').length;

  // ── decision ──
  const allMandatory = mandatory.every((m) => m.status === 'LOLOS');
  const hardNo = mandatory[0].status === 'TIDAK' || mandatory[1].status === 'TIDAK';
  const decision: BuyDecision = !dataOk
    ? 'WATCHLIST'
    : allMandatory && selected && confirmCount >= MIN_CONFIRMATIONS ? 'BELI BERTAHAP' : hardNo ? 'JANGAN BELI' : 'WATCHLIST';

  const reasons: string[] = [];
  if (!dataOk) reasons.push('Histori harga kurang dari 30 sesi — checklist tidak bisa dievaluasi penuh.');
  mandatory.filter((m) => m.status !== 'LOLOS').forEach((m) => reasons.push(`Syarat wajib “${m.label}”: ${m.status}.`));
  reasons.push(selected ? `Skenario ${selected.id} (${selected.name}) cocok.` : 'Tidak ada skenario beli yang cocok saat ini.');
  reasons.push(`Konfirmasi tambahan ${confirmCount}/5${confirmCount < MIN_CONFIRMATIONS ? ` (minimal ${MIN_CONFIRMATIONS})` : ''}.`);

  // ── plan & triggers ──
  const triggers: string[] = [];
  if (!selected) {
    if (prior20High != null && !brokeOut) {
      triggers.push(`Breakout: close > ${rp(prior20High)} dengan volume ≥ ${volMa20 != null ? `${id(Math.round(volMa20 * 1.5))} lembar (1,5× rata-rata)` : '1,5× rata-rata'}.`);
    }
    if (nearestSupport) triggers.push(`Pullback: tunggu harga mendekati ${nearestSupport.name} ${rp(nearestSupport.price)} dengan candle bullish & volume jual kecil.`);
    if (oversoldHit.length >= 3) triggers.push('Rebound: tunggu hammer / bullish engulfing dengan volume naik.');
  }
  if (basePlan && basePlan.tp1 != null && riskReward != null && riskReward < MIN_RR) {
    const maxEntry = floorTick((basePlan.tp1 + MIN_RR * basePlan.sl) / (1 + MIN_RR));
    if (maxEntry > basePlan.sl) triggers.push(`R:R 1:${MIN_RR} baru tercapai jika entry ≤ ${rp(maxEntry)} (SL ${rp(basePlan.sl)}, TP1 ${rp(basePlan.tp1)}).`);
  }
  if (selected?.id === 'B') triggers.push('Tambah 50% kedua jika retest resistensi lama bertahan (close di atasnya).');
  if (selected?.id === 'A') triggers.push('Tambah 50% kedua setelah close di atas high candle bullish di support.');
  if (selected?.id === 'C') triggers.push('Tambah 50% kedua setelah close di atas MA20 atau higher low terbentuk.');
  triggers.push('Jangan menambah posisi hanya karena harga turun; batalkan rencana jika close < SL.');

  const plan: BuyChecklistPlan | null = basePlan
    ? { ...basePlan, riskReward, riskPerShare, riskPct: (riskPerShare / basePlan.entryHigh) * 100, triggers }
    : null;

  // ── data summary ──
  const fmt = (v: number | null, dec = 1) => (v == null ? null : id(v, dec));
  const data: DataPoint[] = [
    { label: 'Ticker', value: summary.ticker },
    { label: 'Bursa', value: 'IDX' },
    { label: 'Tanggal analisis', value: asOf.toISOString().slice(0, 10) },
    { label: 'Timeframe', value: 'Harian' },
    { label: 'Harga terakhir', value: rp(price) },
    { label: 'Tren utama', value: trendLabel, assumption: true },
    { label: 'Support terdekat', value: s1 != null ? rp(s1) : null },
    { label: 'Resistance terdekat', value: r1 != null ? rp(r1) : null },
    { label: 'MA20 / MA50 / MA200', value: ma20 != null ? `${rp(ma20)} / ${rp(ma50)} / ${ma200 != null ? rp(ma200) : 'N/A'}` : null },
    { label: 'RSI(14)', value: fmt(rsiNow) },
    { label: 'Stochastic(14,3,3)', value: stochK != null ? `%K ${id(stochK, 1)} / %D ${stochD != null ? id(stochD, 1) : 'N/A'}` : null },
    { label: 'MFI(14)', value: fmt(mfiNow) },
    { label: 'CCI(20)', value: fmt(cciNow, 0) },
    { label: 'Williams %R(14)', value: fmt(wrNow) },
    { label: 'Volume vs rata-rata 20 hari', value: rvol != null ? `${id(rvol, 2)}×` : null },
    { label: 'Pola candlestick terakhir', value: lastPatternLabel },
    { label: 'Berita/katalis terbaru', value: newsLoading ? null : news[0] ? news[0].title : null },
    { label: 'Aksi korporasi/insider', value: recentDiv ? `Dividen ex ${recentDiv.date}` : null },
    { label: 'Relative strength vs IHSG', value: rs ? `${pct(rs.stock)} vs ${pct(rs.ihsg)} (20 sesi)` : null },
  ];
  const missing = data.filter((d) => d.value == null).map((d) => d.label);
  if (!missing.includes('Aksi korporasi/insider')) missing.push('Transaksi insider (KSEI/IDX)');
  missing.push('Relative strength vs sektor', 'Ukuran modal Anda (untuk menghitung lot)');

  return {
    asOf: asOf.toISOString().slice(0, 10),
    lastBarDate: last?.date ?? null,
    price,
    dataOk,
    data,
    missing,
    mandatory,
    mandatoryPassed,
    scenarios,
    selected: selected?.id ?? null,
    confirmations,
    confirmCount,
    riskReward,
    decision,
    reasons,
    plan,
  };
}
