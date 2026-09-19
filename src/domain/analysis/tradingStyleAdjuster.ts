/**
 * tradingStyleAdjuster.ts
 *
 * Fungsi murni (pure function, no side-effects) yang menyesuaikan TradingPlanAnalysis
 * berdasarkan preferensi gaya trading pengguna (batas CL dan target TP minimum).
 *
 * Logika:
 *  - SL: Jika SL dari engine lebih dalam dari batas CL trader, SL di-cap ke entry × (1 - maxClPct/100)
 *  - TP1: Jika TP1 dari engine lebih rendah dari target minimum, TP1 didorong ke entry × (1 + minTp1Pct/100)
 *  - TP2: Jika TP2 dari engine lebih rendah dari target minimum, TP2 didorong ke entry × (1 + minTp2Pct/100)
 *  - RR: Di-hitung ulang setelah penyesuaian
 *
 * Hanya digunakan untuk tampilan UI sidebar — tidak mengubah data mentah dari engine.
 */

import { TradingPlanAnalysis, TradeScenario } from '@/domain/models/StockAnalysis';
import { TradingStylePrefs } from '@/presentation/features/analysis/useTradingStyle';
import { computeRiskReward, invalidationRuleText, validateTradeScenario } from '@/domain/analysis/tradeValidation';

export interface AdjustedTradeScenario extends TradeScenario {
  slAdjusted: boolean;   // true jika SL di-override karena melebihi batas CL
  tp1Adjusted: boolean;  // true jika TP1 di-override karena di bawah target minimum
  tp2Adjusted: boolean;  // true jika TP2 di-override karena di bawah target minimum
}

export interface AdjustedTradingPlan {
  bullish: AdjustedTradeScenario;
  bearish: AdjustedTradeScenario;
  recommendedBias: TradingPlanAnalysis['recommendedBias'];
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function adjustScenario(
  scenario: TradeScenario,
  prefs: TradingStylePrefs,
  isBullish: boolean
): AdjustedTradeScenario {
  const { entry, tp1, tp2, sl, notes, avgDown } = scenario;

  let newSl = sl;
  let newTp1 = tp1;
  let newTp2 = tp2;
  let slAdjusted = false;
  let tp1Adjusted = false;
  let tp2Adjusted = false;

  if (isBullish) {
    // --- SL: Jika SL lebih dalam dari maxClPct, cap SL ---
    const currentClPct = ((entry - sl) / entry) * 100;
    if (currentClPct > prefs.maxClPct) {
      newSl = round2(entry * (1 - prefs.maxClPct / 100));
      slAdjusted = true;
    }

    // --- TP1: Jika kurang dari minTp1Pct, dorong ke target minimum ---
    const currentTp1Pct = ((tp1 - entry) / entry) * 100;
    if (currentTp1Pct < prefs.minTp1Pct) {
      newTp1 = round2(entry * (1 + prefs.minTp1Pct / 100));
      tp1Adjusted = true;
    }

    // --- TP2: Jika kurang dari minTp2Pct, dorong ke target minimum ---
    const currentTp2Pct = ((tp2 - entry) / entry) * 100;
    if (currentTp2Pct < prefs.minTp2Pct) {
      newTp2 = round2(entry * (1 + prefs.minTp2Pct / 100));
      tp2Adjusted = true;
    }

    // Pastikan TP2 selalu > TP1
    if (newTp2 <= newTp1) {
      newTp2 = round2(newTp1 * 1.05);
      tp2Adjusted = true;
    }
  } else {
    // Bearish (short scenario): logika terbalik
    // SL ada di atas entry
    const currentClPct = ((sl - entry) / entry) * 100;
    if (currentClPct > prefs.maxClPct) {
      newSl = round2(entry * (1 + prefs.maxClPct / 100));
      slAdjusted = true;
    }

    // TP bearish ada di bawah entry
    const currentTp1Pct = ((entry - tp1) / entry) * 100;
    if (currentTp1Pct < prefs.minTp1Pct) {
      newTp1 = round2(entry * (1 - prefs.minTp1Pct / 100));
      tp1Adjusted = true;
    }

    const currentTp2Pct = ((entry - tp2) / entry) * 100;
    if (currentTp2Pct < prefs.minTp2Pct) {
      newTp2 = round2(entry * (1 - prefs.minTp2Pct / 100));
      tp2Adjusted = true;
    }

    // Pastikan TP2 bearish selalu < TP1 bearish
    if (newTp2 >= newTp1) {
      newTp2 = round2(newTp1 * 0.95);
      tp2Adjusted = true;
    }
  }

  // Hitung ulang Risk/Reward — entry tidak berubah, jadi entryDistancePct ikut scenario asli.
  const risk = computeRiskReward(scenario.direction, entry, newSl, newTp1);

  return {
    direction: scenario.direction,
    entryType: scenario.entryType,
    entry,
    avgDown,
    tp1: newTp1,
    tp2: newTp2,
    sl: newSl,
    riskRewardRatio: risk.riskRewardRatio,
    riskPct: risk.riskPct,
    rewardPct: risk.rewardPct,
    entryDistancePct: scenario.entryDistancePct,
    extremeDistanceWarning: scenario.extremeDistanceWarning,
    extremeRRWarning: risk.extremeRRWarning,
    invalidationRule: invalidationRuleText(scenario.direction, newSl),
    validationErrors: validateTradeScenario(scenario.direction, entry, newSl, newTp1, newTp2),
    notes,
    defaultTarget: scenario.defaultTarget,
    slAdjusted,
    tp1Adjusted,
    tp2Adjusted,
  };
}

/**
 * Sesuaikan TradingPlanAnalysis dengan preferensi gaya trading trader.
 * Mengembalikan salinan baru — data asli tidak diubah.
 */
export function applyTradingStyle(
  plan: TradingPlanAnalysis,
  prefs: TradingStylePrefs
): AdjustedTradingPlan {
  return {
    bullish: adjustScenario(plan.bullish, prefs, true),
    bearish: adjustScenario(plan.bearish, prefs, false),
    recommendedBias: plan.recommendedBias,
  };
}
