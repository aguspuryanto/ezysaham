/**
 * swingSuitability.ts
 *
 * EzySaham's decision engine is reframed around one question the EOD data it
 * actually has can answer honestly: "Apakah saham ini layak dipertimbangkan
 * untuk Swing 1–5 hari, dan kalau iya, bagaimana Trading Plan-nya?"
 * (features_kontradiktif.md's Swing 1–5 Day prompt) — not "is this a BUY
 * right now", which needs intraday confirmation this app doesn't have.
 *
 * Swing Suitability is a composite 0–100 score across trend, structure,
 * S/R room, RSI, MACD, volume, volatility (ATR%), momentum, fundamental
 * risk, market regime, liquidity, and recent performance. It answers "is
 * this stock's current condition swing-worthy at all" — it is explicitly
 * NOT a BUY signal (a SWING_CANDIDATE stock can still resolve to WAIT or
 * WAIT_FOR_PULLBACK once Zone Status / Entry Confirmation / Risk Gate run;
 * see riskGate.ts's tradeStatus, which this score never feeds into or
 * overrides).
 */

import { EntryType, IndicatorAnalysis, PriceLevel, TradeDirection, TrendEmaAnalysis, VolumeAnalysis } from '@/domain/models/StockAnalysis';
import { MarketRegime } from '@/domain/analysis/marketRegimeEngine';
import { FundamentalRiskLevel } from '@/domain/analysis/riskGate';

export type SwingSuitabilityClassification = 'SWING_CANDIDATE' | 'WATCHLIST' | 'LOW_QUALITY_SETUP' | 'NO_TRADE';

export interface SwingSuitabilityFactor {
  key: string;
  label: string;
  detail: string;
  score: number;
  max: number;
}

export interface SwingSuitabilityResult {
  score: number; // 0-100
  classification: SwingSuitabilityClassification;
  label: string;
  factors: SwingSuitabilityFactor[];
}

export interface SwingSuitabilityInput {
  price: number;
  trendEma: TrendEmaAnalysis;
  indicators: IndicatorAnalysis;
  volume: VolumeAnalysis;
  isDownCandle: boolean;
  nearestResistance: PriceLevel | undefined;
  atrPct: number; // NaN when unavailable (insufficient bars)
  fundamentalRisk: FundamentalRiskLevel;
  marketRegime: MarketRegime | null; // null when IHSG regime data hasn't loaded yet
  capitalization: number;
  value: number; // avg daily transaction value
  percentChange1M: number;
}

function classify(score: number): SwingSuitabilityClassification {
  if (score >= 75) return 'SWING_CANDIDATE';
  if (score >= 60) return 'WATCHLIST';
  if (score >= 40) return 'LOW_QUALITY_SETUP';
  return 'NO_TRADE';
}

const CLASSIFICATION_LABEL: Record<SwingSuitabilityClassification, string> = {
  SWING_CANDIDATE: 'SWING CANDIDATE',
  WATCHLIST: 'WATCHLIST',
  LOW_QUALITY_SETUP: 'LOW QUALITY SETUP',
  NO_TRADE: 'NO TRADE',
};

/**
 * Weights sum to 100. Each factor is scored from data already computed elsewhere in the analysis
 * pipeline (trendEma/indicators/volume/support-resistance/fundamentalScreening/marketRegime/
 * summary) — nothing here recomputes indicators from raw bars except ATR%, which the caller
 * supplies (src/domain/indicators/atr.ts).
 */
export function computeSwingSuitability(input: SwingSuitabilityInput): SwingSuitabilityResult {
  const { price, trendEma, indicators, volume, isDownCandle, nearestResistance, atrPct, fundamentalRisk, marketRegime, capitalization, value, percentChange1M } = input;

  // 1. Daily Trend — EMA20/50/200 alignment (max 15)
  const fullStack = price > trendEma.ema20 && trendEma.ema20 > trendEma.ema50 && trendEma.ema50 > trendEma.ema200;
  const aboveEma200 = price > trendEma.ema200;
  const midStackHealthy = aboveEma200 && trendEma.ema50 > trendEma.ema200;
  const trendScore = fullStack ? 15 : midStackHealthy ? 10 : aboveEma200 ? 6 : 0;

  // 2. Price Structure — higher-low pattern as a Higher-High/Higher-Low proxy (max 8)
  const structureScore = trendEma.higherLows ? 8 : trendEma.trend === 'bearish' ? 0 : 3;

  // 3. Support & Resistance — room to run before the nearest resistance (max 7)
  const upsidePct = nearestResistance ? ((nearestResistance.price - price) / price) * 100 : Infinity;
  const srScore = upsidePct >= 8 ? 7 : upsidePct >= 3 ? 5 : 2;

  // 4. RSI — favors the 45–65 pullback/momentum zone, penalizes both oversold and overbought extremes (max 10)
  const rsi = indicators.rsi14;
  const rsiScore = rsi >= 45 && rsi <= 65 ? 10 : rsi > 65 && rsi <= 70 ? 7 : rsi >= 30 && rsi < 45 ? 5 : rsi > 70 && rsi <= 80 ? 3 : rsi < 30 ? 3 : 0;

  // 5. MACD (max 8)
  const macdScore =
    indicators.macdSignalType === 'bullish_crossover' ? 8 :
      indicators.macdSignalType === 'bullish' ? 5 :
        indicators.macdSignalType === 'neutral' ? 2 : 0;

  // 6. Volume & Relative Volume — a high-RVOL red candle is distribution, not confirmation (max 8)
  const rvol = volume.relativeVolume;
  const volumeScore = volume.isHighVolume && isDownCandle ? 0 : rvol >= 1.5 ? 8 : rvol >= 1 ? 5 : 2;

  // 7. ATR% — a healthy swing band; too flat can't reach targets, too wild blows through tight SLs (max 8)
  const atrScore = Number.isNaN(atrPct) ? 0 : atrPct >= 1.5 && atrPct <= 6 ? 8 : (atrPct >= 0.8 && atrPct < 1.5) || (atrPct > 6 && atrPct <= 9) ? 5 : 2;

  // 8. Momentum — MACD + RSI acting together, not either alone (max 5)
  const macdBullish = indicators.macdSignalType === 'bullish' || indicators.macdSignalType === 'bullish_crossover';
  const momentumScore = macdBullish && rsi >= 50 && rsi <= 75 ? 5 : macdBullish || rsi >= 50 ? 3 : 0;

  // 9. Fundamental Risk — a risk modifier here too, never an automatic disqualifier on its own (max 10)
  const fundamentalScoreMap: Record<FundamentalRiskLevel, number> = { LOW: 10, MODERATE: 7, MODERATE_HIGH: 3, HIGH: 0 };
  const fundamentalScorePart = fundamentalScoreMap[fundamentalRisk];

  // 10. Market Regime (IHSG) — missing data (not yet loaded) is scored neutral, never penalized (max 8)
  const regimeScore = marketRegime === 'bullish' ? 8 : marketRegime === 'bearish' ? 0 : 4;

  // 11. Liquidity — same bands as evaluateFundamentalScreening's cap/value check (max 8)
  const liquidityScore =
    capitalization >= 50_000_000_000_000 || value >= 20_000_000_000 ? 8 :
      capitalization >= 5_000_000_000_000 || value >= 3_000_000_000 ? 6 :
        value >= 1_000_000_000 ? 3 : 0;

  // 12. Recent Price Performance — healthy 1-month move, not crashing and not already blown out (max 5)
  const perfScore = percentChange1M >= -5 && percentChange1M <= 15 ? 5 : (percentChange1M < -5 && percentChange1M >= -15) || (percentChange1M > 15 && percentChange1M <= 30) ? 3 : 0;

  const factors: SwingSuitabilityFactor[] = [
    { key: 'trend', label: 'Daily Trend', detail: fullStack ? 'EMA20 > EMA50 > EMA200, harga di atas ketiganya' : midStackHealthy ? 'Struktur menengah sehat (>EMA50>EMA200)' : aboveEma200 ? 'Harga di atas EMA200 saja' : 'Harga di bawah EMA200', score: trendScore, max: 15 },
    { key: 'structure', label: 'Price Structure', detail: trendEma.higherLows ? 'Higher-low terbentuk' : trendEma.trend === 'bearish' ? 'Downtrend — belum ada higher-low' : 'Belum ada pola higher-low yang jelas', score: structureScore, max: 8 },
    { key: 'supportResistance', label: 'Support & Resistance', detail: nearestResistance ? `Ruang ke resistance ${nearestResistance.label} ≈ ${upsidePct.toFixed(1)}%` : 'Tidak ada resistance terdekat (ATH/breakout area)', score: srScore, max: 7 },
    { key: 'rsi', label: 'RSI', detail: `RSI ${rsi.toFixed(1)}`, score: rsiScore, max: 10 },
    { key: 'macd', label: 'MACD', detail: indicators.macdNote, score: macdScore, max: 8 },
    { key: 'volume', label: 'Volume & RVOL', detail: `RVOL ${rvol.toFixed(2)}×${volume.isHighVolume && isDownCandle ? ' pada candle merah (distribusi)' : ''}`, score: volumeScore, max: 8 },
    { key: 'atr', label: 'ATR / Volatilitas', detail: Number.isNaN(atrPct) ? 'Data ATR belum cukup' : `ATR ≈ ${atrPct.toFixed(1)}% dari harga`, score: atrScore, max: 8 },
    { key: 'momentum', label: 'Momentum', detail: macdBullish && rsi >= 50 ? 'MACD & RSI bergerak searah bullish' : 'Momentum campuran/lemah', score: momentumScore, max: 5 },
    { key: 'fundamentalRisk', label: 'Fundamental Risk', detail: fundamentalRisk, score: fundamentalScorePart, max: 10 },
    { key: 'marketRegime', label: 'Market Regime (IHSG)', detail: marketRegime ? marketRegime.toUpperCase() : 'Data IHSG belum tersedia', score: regimeScore, max: 8 },
    { key: 'liquidity', label: 'Liquidity', detail: `Kapitalisasi & nilai transaksi harian`, score: liquidityScore, max: 8 },
    { key: 'recentPerformance', label: 'Recent Price Performance', detail: `1M: ${percentChange1M >= 0 ? '+' : ''}${percentChange1M.toFixed(1)}%`, score: perfScore, max: 5 },
  ];

  const score = Math.round(factors.reduce((sum, f) => sum + f.score, 0));
  const classification = classify(score);

  return { score, classification, label: CLASSIFICATION_LABEL[classification], factors };
}

// ─── Setup detection (Buy on Pullback / Buy on Support / Breakout / No Setup) ──
export type SwingSetup = 'BUY_ON_PULLBACK' | 'BUY_ON_SUPPORT' | 'BREAKOUT' | 'NO_SETUP';

export const SWING_SETUP_LABEL: Record<SwingSetup, string> = {
  BUY_ON_PULLBACK: 'Buy on Pullback',
  BUY_ON_SUPPORT: 'Buy on Support',
  BREAKOUT: 'Breakout',
  NO_SETUP: 'No Setup',
};

/**
 * Setup answers "how would this stock be traded", never "trade it now" — that's Final Action's job
 * (features_kontradiktif.md §9: Strategy/Setup and Action must never be collapsed into one field).
 *
 * BREAKOUT is only ever labeled when price has genuinely cleared its recent trading range
 * (priceAction.canContinueUp — close above the prior 20-bar high, not merely a green candle above
 * EMA20) AND that move is volume-confirmed (features_analisa.md rule 1: "Jangan gunakan BREAKOUT
 * kecuali harga benar-benar breakout resistance + confirmation + volume/retest" — the CAMP bug,
 * where an entry anchored at support was labeled "Breakout" off a much looser green-candle check).
 * Whether the breakout additionally survives a retest is still Entry Confirmation's job downstream.
 */
export function detectSwingSetup(params: {
  direction: TradeDirection;
  entryType: EntryType;
  canContinueUp: boolean;
  volumeConfirmed: boolean;
}): SwingSetup {
  if (params.direction !== 'LONG') return 'NO_SETUP';
  if (params.canContinueUp && params.volumeConfirmed) return 'BREAKOUT';
  if (params.entryType === 'BUY_ON_SUPPORT') return 'BUY_ON_SUPPORT';
  return 'BUY_ON_PULLBACK';
}
