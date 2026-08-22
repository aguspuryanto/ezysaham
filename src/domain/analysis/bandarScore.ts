/**
 * bandarScore.ts
 *
 * "Bandar Detector" — a 100-point accumulation/distribution proxy score built
 * purely from Price Action + Volume + OBV (Wyckoff-style effort/result &
 * divergence reasoning). There is no free IDX data source for real Broker
 * Summary or Foreign Flow (that's paid data on Stockbit Pro/RTI Pro), so this
 * deliberately does NOT claim to detect real broker/institutional activity —
 * see `dataNotes` on the result, which is always populated with that caveat.
 *
 * Reuses the same factor-array + classification shape as technicalScore.ts so
 * it renders with the same UI pattern (ScoringCard-style).
 */

import { OHLCVBar } from '@/domain/models/History';
import { StockSummary } from '@/domain/models/Stock';
import { sma } from '@/domain/indicators/movingAverages';
import { obv } from '@/domain/indicators/obv';

export type WyckoffPhase = 'accumulation' | 'markup' | 'distribution' | 'markdown' | 'uncertain';

export interface BandarScoreFactor {
  key: 'priceStructure' | 'volumeSignature' | 'obvDivergence' | 'wyckoffPhase' | 'effortResult';
  label: string;
  detail: string;
  score: number;
  max: number;
}

export type BandarScoreTone = 'green' | 'amber' | 'orange' | 'red';

export interface BandarScoreClassification {
  label: string;
  tone: BandarScoreTone;
}

export interface BandarScoreResult {
  total: number;
  max: number;
  factors: BandarScoreFactor[];
  classification: BandarScoreClassification;
  phase: WyckoffPhase;
  phaseLabel: string;
  /** Price rising/flat while OBV weakens — smart money may be selling into new buyers. */
  hiddenDistributionWarning: boolean;
  dataNotes: string[];
}

function avg(values: number[]): number {
  if (values.length === 0) return NaN;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

// ── 1. Price Structure (max 20) ────────────────────────────────────────────
function calcPriceStructureScore(bars: OHLCVBar[]): { score: number; detail: string } {
  const WINDOW = 20;
  if (bars.length < WINDOW) {
    return { score: 0, detail: 'Data harga belum cukup (< 20 hari) untuk menilai struktur.' };
  }
  const recent = bars.slice(-WINDOW);
  const high = Math.max(...recent.map((b) => b.high));
  const low = Math.min(...recent.map((b) => b.low));
  const rangePct = high > 0 ? ((high - low) / high) * 100 : 100;
  const isSideways = rangePct < 15;

  const swingWindow = bars.slice(-40);
  const swingLows: number[] = [];
  for (let i = 2; i < swingWindow.length - 2; i++) {
    const b = swingWindow[i];
    if (
      b.low <= swingWindow[i - 1].low &&
      b.low <= swingWindow[i - 2].low &&
      b.low <= swingWindow[i + 1].low &&
      b.low <= swingWindow[i + 2].low
    ) {
      swingLows.push(b.low);
    }
  }
  const lastSwingLows = swingLows.slice(-3);
  const higherLows =
    lastSwingLows.length >= 2 && lastSwingLows.every((v, i, arr) => i === 0 || v >= arr[i - 1] * 0.98);

  const score = (isSideways ? 10 : 0) + (higherLows ? 10 : 0);
  const detail = `Range 20D ${rangePct.toFixed(1)}% (${isSideways ? 'sideways/basing' : 'masih trending, belum basing'}), ${higherLows ? 'swing low naik (higher-low)' : 'belum terbentuk pola higher-low yang jelas'}.`;
  return { score, detail };
}

// ── 2. Volume Signature (max 20) ───────────────────────────────────────────
function calcVolumeSignatureScore(bars: OHLCVBar[]): { score: number; detail: string } {
  const WINDOW = 20;
  if (bars.length < WINDOW + 1) {
    return { score: 0, detail: 'Data volume belum cukup untuk menilai rasio volume naik/turun.' };
  }
  const recent = bars.slice(-WINDOW);
  let upVol = 0;
  let downVol = 0;
  for (let i = 1; i < recent.length; i++) {
    if (recent[i].close > recent[i - 1].close) upVol += recent[i].volume;
    else if (recent[i].close < recent[i - 1].close) downVol += recent[i].volume;
  }
  const upDownRatio = downVol > 0 ? upVol / downVol : upVol > 0 ? 2 : 1;
  const ratioScore = upDownRatio >= 1.5 ? 12 : upDownRatio >= 1.2 ? 8 : upDownRatio >= 1 ? 4 : 0;

  const volumes = bars.map((b) => b.volume);
  const volMa20 = sma(volumes, 20);
  const rvolSeries = bars.map((_, i) => (volMa20[i] > 0 ? volumes[i] / volMa20[i] : NaN));
  const last5 = rvolSeries.slice(-5).filter((v) => !Number.isNaN(v));
  const prior15 = rvolSeries.slice(-20, -5).filter((v) => !Number.isNaN(v));
  const rvolRising = last5.length > 0 && prior15.length > 0 && avg(last5) > avg(prior15) * 1.05;
  const rvolScore = rvolRising ? 8 : 0;

  const score = ratioScore + rvolScore;
  const detail = `Volume naik vs turun rasio ${upDownRatio.toFixed(2)}x dalam 20 hari terakhir${rvolRising ? ', RVOL 5D terakhir sedang naik dibanding 15 hari sebelumnya' : ''}.`;
  return { score, detail };
}

// ── 3. OBV Divergence (max 25) ─────────────────────────────────────────────
function calcObvDivergenceScore(bars: OHLCVBar[]): {
  score: number;
  detail: string;
  hiddenDistributionWarning: boolean;
} {
  const WINDOW = 20;
  if (bars.length < WINDOW + 1) {
    return { score: 0, detail: 'Data belum cukup untuk menilai divergensi OBV.', hiddenDistributionWarning: false };
  }

  const obvSeries = obv(bars);
  const recent = bars.slice(-WINDOW);
  const recentObv = obvSeries.slice(-WINDOW);

  const priceStart = recent[0].close;
  const priceEnd = recent[recent.length - 1].close;
  const pricePct = priceStart > 0 ? ((priceEnd - priceStart) / priceStart) * 100 : 0;

  const obvStart = recentObv[0];
  const obvEnd = recentObv[recentObv.length - 1];
  const obvScale = Math.max(...recentObv.map((v) => Math.abs(v)), 1);
  const obvPct = ((obvEnd - obvStart) / obvScale) * 100;

  const priceUp = pricePct > 1.5;
  const priceDown = pricePct < -1.5;
  const obvUp = obvPct > 5;
  const obvDown = obvPct < -5;

  let score: number;
  let detail: string;
  let hiddenDistributionWarning = false;

  if (!priceUp && obvUp) {
    score = 25;
    detail = `Harga ${priceDown ? 'turun' : 'flat'} (${pricePct.toFixed(1)}%) tapi OBV menguat — bullish divergence, indikasi akumulasi tersembunyi.`;
  } else if (priceUp && obvUp) {
    score = 15;
    detail = `Harga naik ${pricePct.toFixed(1)}% dikonfirmasi OBV yang juga menguat — demand sehat, bukan kenaikan kosong.`;
  } else if (priceUp && obvDown) {
    score = 0;
    hiddenDistributionWarning = true;
    detail = `Harga naik ${pricePct.toFixed(1)}% tapi OBV justru melemah — waspada hidden distribution (smart money bisa jadi menjual ke pembeli baru).`;
  } else if (!priceUp && obvDown) {
    score = 3;
    detail = `Harga & OBV sama-sama melemah (${pricePct.toFixed(1)}%) — tekanan jual masih dominan, belum ada tanda akumulasi.`;
  } else {
    score = 8;
    detail = `OBV bergerak relatif mendatar terhadap pergerakan harga (${pricePct.toFixed(1)}%) — belum ada sinyal divergensi yang kuat.`;
  }

  return { score, detail, hiddenDistributionWarning };
}

// ── 4. Wyckoff Phase (max 20) ──────────────────────────────────────────────
function detectSpring(bars: OHLCVBar[]): boolean {
  const LOOKBACK = 20;
  if (bars.length < LOOKBACK + 5) return false;
  const volumes = bars.map((b) => b.volume);
  const volMa20 = sma(volumes, 20);

  for (let i = bars.length - 5; i < bars.length; i++) {
    if (i < LOOKBACK) continue;
    const priorLow = Math.min(...bars.slice(i - LOOKBACK, i).map((b) => b.low));
    if (bars[i].low >= priorLow) continue; // must break below prior range low

    for (let j = i + 1; j <= Math.min(i + 3, bars.length - 1); j++) {
      const volOk = !Number.isNaN(volMa20[j]) && volMa20[j] > 0 && bars[j].volume > volMa20[j];
      if (bars[j].close > priorLow && volOk) return true;
    }
  }
  return false;
}

function calcWyckoffPhaseScore(
  bars: OHLCVBar[],
  summary: StockSummary
): { score: number; phase: WyckoffPhase; phaseLabel: string; detail: string } {
  const WINDOW = 20;
  if (bars.length < WINDOW) {
    return {
      score: 8,
      phase: 'uncertain',
      phaseLabel: 'Belum jelas (data terbatas)',
      detail: 'Data historis kurang dari 20 hari untuk menentukan fase Wyckoff.',
    };
  }

  const recent = bars.slice(-WINDOW);
  const rangeHigh = Math.max(...recent.map((b) => b.high));
  const rangeLow = Math.min(...recent.map((b) => b.low));
  const rangePct = rangeHigh > 0 ? ((rangeHigh - rangeLow) / rangeHigh) * 100 : 100;
  const isSideways = rangePct < 15;
  const pricePosInRange = rangeHigh > rangeLow ? (summary.lastClose - rangeLow) / (rangeHigh - rangeLow) : 0.5;

  const volumes = bars.map((b) => b.volume);
  const volMa20 = sma(volumes, 20);
  const lastVolMa20 = volMa20[volMa20.length - 1];
  const lastRvol = lastVolMa20 > 0 ? summary.volume / lastVolMa20 : NaN;

  const brokeOutAbove = summary.lastClose > rangeHigh * 0.99 && !Number.isNaN(lastRvol) && lastRvol >= 1.5;
  const brokeDownBelow = summary.lastClose < rangeLow * 1.01 && !Number.isNaN(lastRvol) && lastRvol >= 1.5;
  const spring = detectSpring(bars);

  let phase: WyckoffPhase;
  let phaseLabel: string;
  let score: number;

  if (brokeOutAbove) {
    phase = 'markup';
    phaseLabel = 'Markup (breakout dari basing)';
    score = 18;
  } else if (brokeDownBelow) {
    phase = 'markdown';
    phaseLabel = 'Markdown (breakdown dari basing)';
    score = 0;
  } else if (isSideways && pricePosInRange >= 0.35) {
    phase = 'accumulation';
    phaseLabel = spring ? 'Accumulation (terindikasi Spring)' : 'Accumulation (basing di area bawah-tengah range)';
    score = spring ? 20 : 14;
  } else if (isSideways) {
    phase = 'uncertain';
    phaseLabel = 'Basing awal, belum jelas arah';
    score = 8;
  } else if (pricePosInRange >= 0.7) {
    phase = 'distribution';
    phaseLabel = 'Berpotensi Distribution (dekat puncak, momentum melemah)';
    score = 5;
  } else {
    phase = 'uncertain';
    phaseLabel = 'Belum ada fase yang dominan';
    score = 8;
  }

  const detail = `Posisi harga saat ini ${(pricePosInRange * 100).toFixed(0)}% dari range 20D (lebar range ${rangePct.toFixed(1)}%)${spring ? ', terdeteksi pola Spring (false breakdown lalu reclaim dengan volume)' : ''}.`;
  return { score, phase, phaseLabel, detail };
}

// ── 5. Effort vs Result (max 15) ───────────────────────────────────────────
function calcEffortResultScore(bars: OHLCVBar[]): { score: number; detail: string } {
  const LOOKBACK = 10;
  if (bars.length < LOOKBACK + 20) {
    return { score: 0, detail: 'Data belum cukup untuk menilai effort vs result.' };
  }
  const volumes = bars.map((b) => b.volume);
  const volMa20 = sma(volumes, 20);
  const recent = bars.slice(-LOOKBACK);
  const recentRvol = recent.map((b, idx) => {
    const globalIdx = bars.length - LOOKBACK + idx;
    return volMa20[globalIdx] > 0 ? b.volume / volMa20[globalIdx] : NaN;
  });

  let bestIdx = -1;
  let bestRvol = 0;
  recentRvol.forEach((r, i) => {
    if (!Number.isNaN(r) && r > bestRvol) {
      bestRvol = r;
      bestIdx = i;
    }
  });

  if (bestIdx === -1 || bestRvol < 1.8) {
    return { score: 0, detail: 'Belum ada hari dengan volume signifikan (RVOL ≥ 1.8x) dalam 10 hari terakhir.' };
  }

  const bar = recent[bestIdx];
  const prevClose = bestIdx > 0 ? recent[bestIdx - 1].close : bar.open;
  const pctChange = prevClose > 0 ? Math.abs(((bar.close - prevClose) / prevClose) * 100) : 0;
  const dayRange = bar.high - bar.low;
  const closePos = dayRange > 0 ? (bar.close - bar.low) / dayRange : 0.5;

  const isAbsorption = pctChange < 1.5 && closePos >= 0.5;
  const score = isAbsorption ? 15 : bar.close > prevClose ? 8 : 0;
  const detail = isAbsorption
    ? `Volume tertinggi 10 hari terakhir (${bestRvol.toFixed(1)}x rata-rata) hanya menghasilkan pergerakan harga ${pctChange.toFixed(1)}% — indikasi absorption (supply diserap habis).`
    : `Volume tertinggi 10 hari terakhir (${bestRvol.toFixed(1)}x rata-rata) menghasilkan pergerakan ${pctChange.toFixed(1)}% — effort & result masih sebanding, belum ada tanda absorption yang jelas.`;
  return { score, detail };
}

// ── Composite ───────────────────────────────────────────────────────────────
export function computeBandarScore(summary: StockSummary, bars: OHLCVBar[]): BandarScoreResult {
  const priceStructure = calcPriceStructureScore(bars);
  const volumeSignature = calcVolumeSignatureScore(bars);
  const obvDivergence = calcObvDivergenceScore(bars);
  const wyckoff = calcWyckoffPhaseScore(bars, summary);
  const effortResult = calcEffortResultScore(bars);

  const factors: BandarScoreFactor[] = [
    {
      key: 'priceStructure',
      label: 'Struktur Harga',
      detail: priceStructure.detail,
      score: priceStructure.score,
      max: 20,
    },
    {
      key: 'volumeSignature',
      label: 'Volume Signature',
      detail: volumeSignature.detail,
      score: volumeSignature.score,
      max: 20,
    },
    {
      key: 'obvDivergence',
      label: 'OBV Divergence',
      detail: obvDivergence.detail,
      score: obvDivergence.score,
      max: 25,
    },
    {
      key: 'wyckoffPhase',
      label: 'Fase Wyckoff',
      detail: wyckoff.detail,
      score: wyckoff.score,
      max: 20,
    },
    {
      key: 'effortResult',
      label: 'Effort vs Result',
      detail: effortResult.detail,
      score: effortResult.score,
      max: 15,
    },
  ];

  const total = Math.round(factors.reduce((sum, f) => sum + f.score, 0));
  const max = factors.reduce((sum, f) => sum + f.max, 0);

  const classification: BandarScoreClassification =
    total >= 80
      ? { label: 'Strong Accumulation', tone: 'green' }
      : total >= 65
        ? { label: 'Accumulation', tone: 'green' }
        : total >= 50
          ? { label: 'Neutral', tone: 'amber' }
          : total >= 35
            ? { label: 'Distribution Risk', tone: 'orange' }
            : { label: 'Strong Distribution', tone: 'red' };

  const dataNotes: string[] = [
    'Skor ini adalah proxy dari Price Action + Volume + OBV historis (pendekatan Wyckoff). Data Broker Summary & Foreign Flow tidak tersedia lewat API gratis, sehingga TIDAK ikut dihitung — gunakan sebagai salah satu input, bukan satu-satunya sinyal "bandar".',
  ];
  if (bars.length < 40) {
    dataNotes.push(`Riwayat harga hanya ${bars.length} hari — sebagian faktor mungkin kurang akurat untuk saham yang baru listing/IPO.`);
  }

  return {
    total,
    max,
    factors,
    classification,
    phase: wyckoff.phase,
    phaseLabel: wyckoff.phaseLabel,
    hiddenDistributionWarning: obvDivergence.hiddenDistributionWarning,
    dataNotes,
  };
}
