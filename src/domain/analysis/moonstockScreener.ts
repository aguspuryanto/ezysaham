/**
 * moonstockScreener.ts
 *
 * Moonstock discovery radar (docs/features_moonstock.md) — three screeners over the market universe:
 *
 *   🌙 INTRADAY   price > VWAP, RVOL ≥ 1,5×, volume > 100.000 lembar, change > 0%, momentum MODERATE/STRONG,
 *                 breakout or near resistance, size L/M, value ≥ Rp 5 M.        → 🔥 BREAKOUT · ⚡ MOMENTUM · 👀 WATCH · 🔴 AVOID CHASING
 *                 (AVOID CHASING = EXTENDED / distribution, or already up ≥ CHASE_1D_PCT today — Decision Engine v3's chase rule.)
 *   🚀 SWING      price > EMA20 > EMA50 (EMA50 > EMA200 ranked first), HH + HL, RSI 50–70, RVOL ≥ 1,2×,
 *                 candidate upside ≥ 20% & R:R ≥ 1:2, size M/L, value ≥ Rp 10 M. → 🚀 BREAKOUT · 🔄 PULLBACK · 🟡 DEVELOPING · 🔴 AVOID
 *   💰 INVESTING  revenue & profit growth > 15%, ROE > 15%, D/E < 1,0, net margin > 10%, reasonable valuation,
 *                 size M/L, value ≥ Rp 50 M.                                    → 💎 UNDERVALUED · 🟢 QUALITY · 🟡 FAIR VALUE · 🔴 VALUE TRAP RISK
 *
 * Global rules: a DISCOVERY RADAR, never a BUY engine (Candidate ≠ BUY — the Momentum Trade Engine and its HARD
 * RISK GATE validate). Candidates only come from a compatible snapshot: empty data → EMPTY, stale data → STALE,
 * a stock whose bars / VWAP / fundamentals don't match the snapshot is skipped (never guessed). No candidate
 * is forced. Pure & deterministic: same inputs → same rows, same order (ties broken by ticker).
 */

import { evaluateFundamentalScreening } from '@/domain/analysis/aiStockEngine';
import { computeDataFreshness } from '@/domain/analysis/dataFreshness';
import { CHASE_1D_PCT, isBullishStructure, priceStructure } from '@/domain/analysis/decisionEngineV3';
import { buildMomentumInput } from '@/domain/analysis/decisionInput';
import { buildFundamentalPillars, isFinancial, ValuationVerdict } from '@/domain/analysis/fundamentalPillars';
import { MomentumInput } from '@/domain/analysis/momentumSpeculation';
import { buildMomentumTrade, MomentumGrade, MomentumTradeReport, StructureGrade } from '@/domain/analysis/momentumTradeEngine';
import { computeStockAnalysis } from '@/domain/analysis/stockAnalysisEngine';
import { FundamentalDetail } from '@/domain/models/Fundamentals';
import { OHLCVBar } from '@/domain/models/History';
import { StockSummary } from '@/domain/models/Stock';

// ─── Thresholds ─────────────────────────────────────────────────────────────────

/** Size buckets by market cap: L ≥ Rp 10 T, M ≥ Rp 1 T, else S. */
export const LARGE_CAP = 10e12;
export const MID_CAP = 1e12;

export const INTRADAY_RULES = { minValue: 5e9, minVolume: 100_000, minRvol: 1.5, nearResistancePct: 5 } as const;
export const SWING_RULES = { minValue: 10e9, minRvol: 1.2, rsiMin: 50, rsiMax: 70, minUpsidePct: 20, minRR: 2 } as const;
export const INVESTING_RULES = {
  minValue: 50e9, minRevenueGrowth: 15, minProfitGrowth: 15, minRoe: 15, maxDebtToEquityPct: 100, minNetMargin: 10,
  /** QUALITY = ROE and net margin at least this high. */
  qualityRoe: 20, qualityMargin: 15,
  /** GROWTH status = revenue AND profit growth at least this high. */
  growthStatusPct: 25,
} as const;
/** Summary data is a coarse pre-filter only — keep a margin so the bar-based check decides. */
const PREFILTER_VALUE_MARGIN = 0.5;

// ─── Types ──────────────────────────────────────────────────────────────────────

export type MoonstockMode = 'intraday' | 'swing' | 'investing';
export type MoonStatus = 'HOT' | 'SOLID' | 'GROWTH' | 'WATCH';
export type CapSize = 'L' | 'M' | 'S';
export type IntradayLabel = 'BREAKOUT' | 'MOMENTUM' | 'WATCH' | 'AVOID CHASING';
export type SwingLabel = 'BREAKOUT' | 'PULLBACK' | 'DEVELOPING' | 'AVOID';
export type InvestingLabel = 'UNDERVALUED' | 'QUALITY' | 'FAIR VALUE' | 'VALUE TRAP RISK';
export type ScanState = 'OK' | 'EMPTY' | 'STALE';

export const MOONSTOCK_MODE_LABEL: Record<MoonstockMode, string> = {
  intraday: '🌙 Moonstock Intraday',
  swing: '🚀 Moonstock Swing',
  investing: '💰 Moonstock Investing',
};

export const LABEL_EMOJI: Record<IntradayLabel | SwingLabel | InvestingLabel, string> = {
  BREAKOUT: '🔥',
  MOMENTUM: '⚡',
  WATCH: '👀',
  'AVOID CHASING': '🔴',
  PULLBACK: '🔄',
  DEVELOPING: '🟡',
  AVOID: '🔴',
  UNDERVALUED: '💎',
  QUALITY: '🟢',
  'FAIR VALUE': '🟡',
  'VALUE TRAP RISK': '🔴',
};
/** Swing's breakout uses 🚀 (intraday's is 🔥) — per the spec. */
export const labelEmoji = (mode: MoonstockMode, label: string): string =>
  mode === 'swing' && label === 'BREAKOUT' ? '🚀' : LABEL_EMOJI[label as keyof typeof LABEL_EMOJI] ?? '';

interface RowBase {
  ticker: string;
  name: string;
  sector: string;
  price: number;
  changePct: number | null;
  cap: CapSize;
  /** Traded value of the snapshot bar (Rp). */
  value: number;
  status: MoonStatus;
  setup: string;
  trigger: string;
  /** Ranking inside a label — not a buy score. */
  rank: number;
}

export interface IntradayRow extends RowBase {
  mode: 'intraday';
  label: IntradayLabel;
  vwap: number;
  rvol: number;
  volume: number;
  momentum: MomentumGrade;
  structure: StructureGrade;
  resistance: number | null;
}

export interface SwingRow extends RowBase {
  mode: 'swing';
  label: SwingLabel;
  /** UPTREND KUAT = EMA 50 > EMA 200. */
  trend: 'UPTREND KUAT' | 'UPTREND';
  ema200Available: boolean;
  structure: string;
  rsi: number;
  rvol: number;
  support: number | null;
  resistance: number | null;
  /** Candidate upside to the next resistance (null = no resistance overhead, measured move used). */
  upsidePct: number | null;
  potentialPct: number | null;
  riskReward: number | null;
}

export interface InvestingRow extends RowBase {
  mode: 'investing';
  label: InvestingLabel;
  per: number | null;
  pbv: number | null;
  roe: number | null;
  revenueGrowth: number;
  profitGrowth: number;
  netMargin: number;
  /** % (100 = 1,0×). Null for banks/insurers, where D/E is not meaningful. */
  debtToEquity: number | null;
  /** Operating cash flow is not in the data feed → always null (shown as N/A, never guessed). */
  cashFlow: null;
  valuation: ValuationVerdict;
  fairValue: number | null;
  quality: 'TINGGI' | 'BAIK';
}

export type MoonstockRow = IntradayRow | SwingRow | InvestingRow;

export interface MoonstockStockInput {
  summary: StockSummary;
  bars: OHLCVBar[];
  /** Intraday only: session VWAP and the session date (YYYY-MM-DD, WIB) it belongs to. */
  vwap?: { value: number; sessionDate: string } | null;
  /** Investing only. */
  fundamentals?: FundamentalDetail | null;
}

export interface MoonstockScan {
  mode: MoonstockMode;
  state: ScanState;
  /** Why the scan is EMPTY / STALE, or a one-line summary when OK. */
  stateNote: string;
  /** Snapshot date (latest daily bar across the universe). */
  dataDate: string | null;
  /** Stocks evaluated (after the summary pre-filter). */
  evaluated: number;
  /** Stocks skipped because their data doesn't match the snapshot (stale bars, no VWAP, no fundamentals). */
  incompatible: number;
  rows: MoonstockRow[];
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

const fin = (n: number | null | undefined): n is number => n != null && Number.isFinite(n);
const pct = (a: number, b: number) => (a / b - 1) * 100;
const rp = (n: number) => `Rp ${Math.round(n).toLocaleString('id-ID')}`;
const n1 = (n: number) => (Math.round(n * 10) / 10).toLocaleString('id-ID', { maximumFractionDigits: 1 });

export function capSize(capitalization: number): CapSize {
  return capitalization >= LARGE_CAP ? 'L' : capitalization >= MID_CAP ? 'M' : 'S';
}

const LABEL_ORDER: Record<string, number> = {
  BREAKOUT: 0, MOMENTUM: 1, PULLBACK: 1, UNDERVALUED: 0, QUALITY: 1, DEVELOPING: 2, 'FAIR VALUE': 2, WATCH: 2,
  'AVOID CHASING': 3, AVOID: 3, 'VALUE TRAP RISK': 3,
};

/** Coarse, summary-only pre-filter (before any per-stock fetch). The bar / fundamental checks decide. */
export function moonstockPrefilter(mode: MoonstockMode, s: StockSummary): boolean {
  if (!(s.lastClose > 0) || capSize(s.capitalization) === 'S') return false;
  if (mode === 'intraday') return s.value >= INTRADAY_RULES.minValue * PREFILTER_VALUE_MARGIN;
  if (mode === 'swing') return s.value >= SWING_RULES.minValue * PREFILTER_VALUE_MARGIN;
  return s.value >= INVESTING_RULES.minValue * PREFILTER_VALUE_MARGIN && s.roe > INVESTING_RULES.minRoe && s.per > 0;
}

interface Snapshot {
  summary: StockSummary;
  last: OHLCVBar;
  changePct: number | null;
  value: number;
  cap: CapSize;
}

/** Summary re-based on the snapshot bar (same as the detail page: Yahoo bar is the price reference). */
function snapshotOf(i: MoonstockStockInput): Snapshot {
  const last = i.bars[i.bars.length - 1];
  const prev = i.bars[i.bars.length - 2];
  const changePct = prev && prev.close > 0 ? pct(last.close, prev.close) : null;
  const summary: StockSummary = {
    ...i.summary,
    lastClose: last.close,
    prevClose: prev?.close ?? i.summary.prevClose,
    percentChange1D: changePct ?? i.summary.percentChange1D,
  };
  return { summary, last, changePct, value: last.close * last.volume, cap: capSize(i.summary.capitalization) };
}

/** Technical read shared with the detail page: StockAnalysis → MomentumInput → Momentum Trade Engine. */
function technicalOf(snap: Snapshot, bars: OHLCVBar[]): { input: MomentumInput; mt: MomentumTradeReport } {
  const analysis = computeStockAnalysis(snap.summary, bars);
  const pillars = buildFundamentalPillars(snap.summary, null, evaluateFundamentalScreening(snap.summary));
  const input = buildMomentumInput({ summary: snap.summary, bars, analysis, fundamentals: null, pillars, vwap: null, longBars: bars });
  return { input, mt: buildMomentumTrade(input) };
}

const riskyStructure = (mt: MomentumTradeReport) =>
  mt.structure === 'EXTENDED' || mt.structure === 'DISTRIBUTION' || mt.exitRisk === 'HIGH' || mt.exitRisk === 'EXTREME';

/**
 * Intraday daily-bar gate — run BEFORE fetching the 1-minute feed so VWAP is only requested for stocks
 * that can still qualify (change > 0, volume, value, RVOL from the daily bars).
 */
export function intradayNeedsVwap(i: MoonstockStockInput): boolean {
  if (i.bars.length < 21) return false;
  const snap = snapshotOf(i);
  if (snap.cap === 'S' || snap.changePct == null || snap.changePct <= 0) return false;
  if (snap.last.volume <= INTRADAY_RULES.minVolume || snap.value < INTRADAY_RULES.minValue) return false;
  const prior = i.bars.slice(-21, -1);
  const avgVol = prior.reduce((a, b) => a + b.volume, 0) / prior.length;
  return avgVol > 0 && snap.last.volume / avgVol >= INTRADAY_RULES.minRvol * 0.9;
}

// ─── Screeners ──────────────────────────────────────────────────────────────────

type Outcome<R> = R | 'SKIP' | 'INCOMPATIBLE';

function screenIntraday(i: MoonstockStockInput): Outcome<IntradayRow> {
  const snap = snapshotOf(i);
  const { last, changePct, value, cap, summary } = snap;
  if (cap === 'S' || changePct == null || changePct <= 0) return 'SKIP';
  if (last.volume <= INTRADAY_RULES.minVolume || value < INTRADAY_RULES.minValue) return 'SKIP';
  if (!i.vwap || i.vwap.sessionDate !== last.date || !(i.vwap.value > 0)) return 'INCOMPATIBLE';
  const price = last.close;
  const vwap = i.vwap.value;
  if (!(price > vwap)) return 'SKIP';

  const { input, mt } = technicalOf(snap, i.bars);
  if (!mt.dataOk) return 'INCOMPATIBLE';
  const rvol = input.rvol;
  if (rvol == null || rvol < INTRADAY_RULES.minRvol) return 'SKIP';
  if (mt.momentum !== 'MODERATE' && mt.momentum !== 'STRONG') return 'SKIP';

  const resistance = mt.metrics.nearestResistance;
  const breakoutLevel = mt.metrics.breakoutLevel;
  const breakout = mt.setup === 'BREAKOUT' || mt.setup === 'RETEST' || (breakoutLevel != null && price > breakoutLevel);
  const nearResistance = resistance != null && pct(resistance, price) <= INTRADAY_RULES.nearResistancePct;
  if (!breakout && !nearResistance) return 'SKIP';

  const chasing = changePct >= CHASE_1D_PCT;
  const label: IntradayLabel = riskyStructure(mt) || chasing ? 'AVOID CHASING' : breakout ? 'BREAKOUT' : mt.momentum === 'STRONG' ? 'MOMENTUM' : 'WATCH';
  const trigger = {
    BREAKOUT: `Bertahan di atas level breakout ${breakoutLevel != null ? rp(breakoutLevel) : ''} dan VWAP ${rp(vwap)}; jangan kejar jauh di atas level.`,
    MOMENTUM: `Tembus resistance ${resistance != null ? rp(resistance) : ''} dengan RVOL ≥ ${n1(INTRADAY_RULES.minRvol)}× dan tetap di atas VWAP ${rp(vwap)}.`,
    WATCH: `Pantau: harga harus tembus ${resistance != null ? rp(resistance) : 'resistance'} dan bertahan di atas VWAP ${rp(vwap)}.`,
    'AVOID CHASING': `Jangan kejar${chasing ? ` — sudah naik ${n1(changePct)}% hari ini` : ''}; tunggu reset ke VWAP ${rp(vwap)} / EMA 20 dan trigger baru.`,
  }[label];

  return {
    mode: 'intraday', ticker: summary.ticker, name: summary.name, sector: summary.sector, price, changePct, cap, value,
    label, status: label === 'BREAKOUT' || label === 'MOMENTUM' ? 'HOT' : 'WATCH',
    setup: breakout ? 'BREAKOUT' : 'NEAR RESISTANCE', trigger,
    rank: rvol * 10 + changePct + (mt.momentum === 'STRONG' ? 10 : 0),
    vwap, rvol, volume: last.volume, momentum: mt.momentum, structure: mt.structure, resistance,
  };
}

function screenSwing(i: MoonstockStockInput): Outcome<SwingRow> {
  const snap = snapshotOf(i);
  const { last, changePct, value, cap, summary } = snap;
  if (cap === 'S' || value < SWING_RULES.minValue) return 'SKIP';
  const { input, mt } = technicalOf(snap, i.bars);
  if (!mt.dataOk) return 'INCOMPATIBLE';
  const price = last.close;
  const { ema20, ema50, ema200, rsi14, rvol } = input;
  if (!fin(ema20) || !fin(ema50) || !fin(rsi14)) return 'INCOMPATIBLE';
  if (!(price > ema20 && ema20 > ema50)) return 'SKIP';
  if (mt.structure === 'DOWNTREND') return 'SKIP';
  const st = priceStructure(i.bars);
  if (!isBullishStructure(st)) return 'SKIP';
  if (rsi14 < SWING_RULES.rsiMin || rsi14 > SWING_RULES.rsiMax) return 'SKIP';
  if (rvol == null || rvol < SWING_RULES.minRvol) return 'SKIP';

  // Upside / R:R of the momentum engine's Candidate Setup (percentages only — not a trade plan).
  const cs = mt.candidateStats;
  if (!cs) return 'SKIP';
  const upsideOk = cs.upsidePct == null ? cs.potentialPct != null && cs.potentialPct >= SWING_RULES.minUpsidePct : cs.upsidePct >= SWING_RULES.minUpsidePct;
  if (!upsideOk || cs.riskReward == null || cs.riskReward < SWING_RULES.minRR) return 'SKIP';

  const strong = fin(ema200) && ema50 > ema200;
  const label: SwingLabel = riskyStructure(mt) ? 'AVOID'
    : mt.setup === 'BREAKOUT' || mt.setup === 'RETEST' ? 'BREAKOUT'
      : mt.setup === 'PULLBACK' ? 'PULLBACK' : 'DEVELOPING';
  const resistance = mt.metrics.nearestResistance;
  const breakoutLevel = mt.metrics.breakoutLevel;
  const trigger = {
    BREAKOUT: `Bertahan di atas level breakout ${breakoutLevel != null ? rp(breakoutLevel) : ''} (maks +3%) dengan volume terjaga.`,
    PULLBACK: `Candle pantulan hijau di area EMA 20 (${rp(ema20)}) dengan volume mengecil.`,
    DEVELOPING: `Breakout ${resistance != null ? rp(resistance) : 'resistance'} dengan RVOL ≥ 1,5× atau pullback sehat ke EMA 20 (${rp(ema20)}).`,
    AVOID: `Struktur extended/berisiko — tunggu reset ke EMA 20 (${rp(ema20)}) dan trigger baru.`,
  }[label];

  return {
    mode: 'swing', ticker: summary.ticker, name: summary.name, sector: summary.sector, price, changePct, cap, value,
    label, status: label === 'BREAKOUT' ? 'HOT' : label === 'PULLBACK' || (label === 'DEVELOPING' && strong) ? 'SOLID' : 'WATCH',
    setup: label === 'DEVELOPING' ? 'MOMENTUM DEVELOPING' : label === 'AVOID' ? mt.structure : label,
    trigger,
    rank: (strong ? 20 : 0) + rvol * 5 + (cs.riskReward ?? 0) * 2 - Math.abs(rsi14 - 60) / 2,
    trend: strong ? 'UPTREND KUAT' : 'UPTREND', ema200Available: fin(ema200),
    structure: st.label, rsi: rsi14, rvol,
    support: mt.metrics.nearestSupport, resistance,
    upsidePct: cs.upsidePct, potentialPct: cs.potentialPct, riskReward: cs.riskReward,
  };
}

function screenInvesting(i: MoonstockStockInput): Outcome<InvestingRow> {
  const snap = snapshotOf(i);
  const { last, changePct, value, cap, summary } = snap;
  if (cap === 'S' || value < INVESTING_RULES.minValue) return 'SKIP';
  const f = i.fundamentals;
  if (!f) return 'INCOMPATIBLE';
  const financial = isFinancial(summary);
  const { revenueGrowth, earningsGrowth, netMargin, debtToEquity } = f;
  if (!fin(revenueGrowth) || !fin(earningsGrowth) || !fin(netMargin) || (!financial && !fin(debtToEquity))) return 'INCOMPATIBLE';
  const roe = summary.roe !== 0 ? summary.roe : null;
  const per = summary.per > 0 ? summary.per : null;
  const pbv = summary.pbv > 0 ? summary.pbv : null;

  const pillars = buildFundamentalPillars(summary, f, evaluateFundamentalScreening(summary));
  const valuation = pillars.valuation.verdict;
  const cheap = valuation === 'UNDERVALUED';
  // Value trap: looks cheap, but revenue or profit is shrinking.
  const valueTrap = cheap && (revenueGrowth < 0 || earningsGrowth < 0);

  const pass =
    revenueGrowth > INVESTING_RULES.minRevenueGrowth && earningsGrowth > INVESTING_RULES.minProfitGrowth
    && roe != null && roe > INVESTING_RULES.minRoe && netMargin > INVESTING_RULES.minNetMargin
    && (financial || debtToEquity! < INVESTING_RULES.maxDebtToEquityPct)
    && per != null && (valuation === 'UNDERVALUED' || valuation === 'WAJAR' || valuation === 'PREMIUM');
  if (!pass && !valueTrap) return 'SKIP';

  const highQuality = roe != null && roe >= INVESTING_RULES.qualityRoe && netMargin >= INVESTING_RULES.qualityMargin;
  const label: InvestingLabel | null = valueTrap ? 'VALUE TRAP RISK'
    : cheap ? 'UNDERVALUED' : highQuality ? 'QUALITY' : valuation === 'WAJAR' ? 'FAIR VALUE' : null;
  if (!label) return 'SKIP'; // PREMIUM without top quality → valuation not reasonable.

  const growth = revenueGrowth >= INVESTING_RULES.growthStatusPct && earningsGrowth >= INVESTING_RULES.growthStatusPct;
  const fairValue = pillars.valuation.fairValue;
  const trigger = {
    UNDERVALUED: `Valuasi di bawah wajar${fairValue != null ? ` (fair value ${rp(fairValue)})` : ''} — cek konsistensi laba 4 kuartal & arus kas sebelum akumulasi.`,
    QUALITY: 'Kualitas tinggi (ROE & margin) — akumulasi bertahap saat koreksi ke area valuasi wajar.',
    'FAIR VALUE': `Valuasi wajar${fairValue != null ? ` (fair value ${rp(fairValue)})` : ''} — tunggu harga lebih menarik atau pertumbuhan berlanjut.`,
    'VALUE TRAP RISK': 'Murah tapi pendapatan/laba turun — hindari sampai pertumbuhan kembali positif.',
  }[label];

  return {
    mode: 'investing', ticker: summary.ticker, name: summary.name, sector: summary.sector, price: last.close, changePct, cap, value,
    label, status: valueTrap ? 'WATCH' : growth ? 'GROWTH' : 'SOLID',
    setup: valueTrap ? 'VALUE TRAP' : cheap ? 'VALUE' : growth ? 'GROWTH' : highQuality ? 'QUALITY' : 'FAIR VALUE',
    trigger,
    rank: (roe ?? 0) + revenueGrowth / 2 + earningsGrowth / 2 + netMargin,
    per, pbv, roe, revenueGrowth, profitGrowth: earningsGrowth, netMargin,
    debtToEquity: financial ? null : debtToEquity, cashFlow: null, valuation, fairValue,
    quality: highQuality ? 'TINGGI' : 'BAIK',
  };
}

// ─── Scan ───────────────────────────────────────────────────────────────────────

/**
 * Screens a fetched universe. `now` only decides STALE (data age in trading days); everything else is a
 * pure function of the inputs. Rows: label priority → rank → ticker.
 */
export function screenMoonstock(mode: MoonstockMode, inputs: MoonstockStockInput[], now: Date): MoonstockScan {
  const withBars = inputs.filter((x) => x.bars.length > 0);
  const base = { mode, evaluated: inputs.length, rows: [] as MoonstockRow[] };
  if (withBars.length === 0) {
    return { ...base, state: 'EMPTY', stateNote: 'Data kosong — tidak ada snapshot harga yang tersedia.', dataDate: null, incompatible: inputs.length };
  }
  const dataDate = withBars.reduce((d, x) => (x.bars[x.bars.length - 1].date > d ? x.bars[x.bars.length - 1].date : d), '');
  const fresh = computeDataFreshness([{ date: dataDate, open: 0, high: 0, low: 0, close: 0, volume: 0 }], now);
  if (fresh?.tier === 'stale') {
    return {
      ...base, state: 'STALE', dataDate, incompatible: 0,
      stateNote: `Data stale — snapshot terakhir ${dataDate} (${fresh.ageInTradingDays} hari bursa lalu). Kandidat tidak ditampilkan.`,
    };
  }

  let incompatible = 0;
  const rows: MoonstockRow[] = [];
  const screen = mode === 'intraday' ? screenIntraday : mode === 'swing' ? screenSwing : screenInvesting;
  for (const x of inputs) {
    // Bars that don't end on the snapshot date (suspended / stale ticker) are not compatible.
    if (x.bars.length === 0 || x.bars[x.bars.length - 1].date !== dataDate) { incompatible += 1; continue; }
    const out = screen(x);
    if (out === 'INCOMPATIBLE') incompatible += 1;
    else if (out !== 'SKIP') rows.push(out);
  }
  rows.sort((a, b) => (LABEL_ORDER[a.label] ?? 9) - (LABEL_ORDER[b.label] ?? 9) || b.rank - a.rank || a.ticker.localeCompare(b.ticker));

  return {
    ...base,
    rows,
    dataDate,
    incompatible,
    state: rows.length ? 'OK' : 'EMPTY',
    stateNote: rows.length
      ? `${rows.length} kandidat dari ${inputs.length} saham yang dipindai.`
      : `Tidak ada saham yang lolos filter ${MOONSTOCK_MODE_LABEL[mode]} pada snapshot ini — tidak ada kandidat yang dipaksakan.`,
  };
}
