/**
 * aiStockEngine.ts
 *
 * Integrates:
 * 1. Fundamental screening (PER, PBV, ROE, Market Cap, Liquidity)
 * 2. Technical screening (Trend, EMA, S/R, Price Action, RVOL, Indicators)
 * 3. News analysis & sentiment summary
 * 4. Breakout Hunter scores
 *
 * Synthesizes clear AI Verdict, Confidence Score, "Reasons to Buy", and "Reasons to Avoid".
 */

import { AiStockAdvisor, AiVerdict, NewsSentimentSummary } from '@/domain/models/News';
import { StockSummary } from '@/domain/models/Stock';
import { StockAnalysis } from '@/domain/models/StockAnalysis';
import { BreakoutScores } from '@/domain/screener/presets';
import { DataFreshness } from '@/domain/analysis/dataFreshness';
import { formatCompact, formatRupiah } from '@/lib/format';

export interface FundamentalScreeningResult {
  score: number; // 0-100
  passed: boolean;
  statusText: string;
  perStatus: { label: string; tone: 'green' | 'amber' | 'red'; detail: string };
  pbvStatus: { label: string; tone: 'green' | 'amber' | 'red'; detail: string };
  roeStatus: { label: string; tone: 'green' | 'amber' | 'red'; detail: string };
  capStatus: { label: string; tone: 'green' | 'amber' | 'red'; detail: string };
}

export interface TechnicalScreeningResult {
  score: number; // 0-100
  passed: boolean;
  statusText: string;
  trendStatus: { label: string; tone: 'green' | 'amber' | 'red'; detail: string };
  momentumStatus: { label: string; tone: 'green' | 'amber' | 'red'; detail: string };
  volumeStatus: { label: string; tone: 'green' | 'amber' | 'red'; detail: string };
  resistanceStatus: { label: string; tone: 'green' | 'amber' | 'red'; detail: string };
}

export function evaluateFundamentalScreening(summary: StockSummary): FundamentalScreeningResult {
  const { per, pbv, roe, capitalization, value } = summary;

  let scoreSum = 0;
  const totalWeight = 100;

  // 1. PER (25%)
  let perTone: 'green' | 'amber' | 'red' = 'amber';
  let perDetail = '';
  if (per > 0 && per <= 12) {
    scoreSum += 25;
    perTone = 'green';
    perDetail = `PER ${per.toFixed(1)}× — Valuasi tergolong sangat murah (undervalued).`;
  } else if (per > 12 && per <= 20) {
    scoreSum += 18;
    perTone = 'green';
    perDetail = `PER ${per.toFixed(1)}× — Valuasi wajar (fair value) untuk pasar BEI.`;
  } else if (per > 20 && per <= 35) {
    scoreSum += 10;
    perTone = 'amber';
    perDetail = `PER ${per.toFixed(1)}× — Valuasi cukup premium, membutuhkan pertumbuhan laba konsisten.`;
  } else if (per > 35) {
    scoreSum += 5;
    perTone = 'red';
    perDetail = `PER ${per.toFixed(1)}× — Valuasi sangat mahal, risiko koreksi jika ekspektasi laba meleset.`;
  } else {
    scoreSum += 0;
    perTone = 'red';
    perDetail = 'PER negatif / Perusahaan mencatat kerugian operasional.';
  }

  // 2. PBV (25%)
  let pbvTone: 'green' | 'amber' | 'red' = 'amber';
  let pbvDetail = '';
  if (pbv > 0 && pbv < 1.0) {
    scoreSum += 25;
    pbvTone = 'green';
    pbvDetail = `PBV ${pbv.toFixed(2)}× — Harga di bawah nilai buku bersih perusahaan (diskon aset).`;
  } else if (pbv >= 1.0 && pbv <= 2.5) {
    scoreSum += 20;
    pbvTone = 'green';
    pbvDetail = `PBV ${pbv.toFixed(2)}× — Rentang harga terhadap aset bersih sangat sehat.`;
  } else if (pbv > 2.5 && pbv <= 5.0) {
    scoreSum += 12;
    pbvTone = 'amber';
    pbvDetail = `PBV ${pbv.toFixed(2)}× — Premium aset lumayan tinggi.`;
  } else if (pbv > 5.0) {
    scoreSum += 5;
    pbvTone = 'red';
    pbvDetail = `PBV ${pbv.toFixed(2)}× — Pasar membayar diskon aset yang sangat mahal.`;
  } else {
    scoreSum += 5;
    pbvTone = 'amber';
    pbvDetail = 'Data PBV tidak tersedia.';
  }

  // 3. ROE (30%)
  let roeTone: 'green' | 'amber' | 'red' = 'amber';
  let roeDetail = '';
  if (roe >= 15) {
    scoreSum += 30;
    roeTone = 'green';
    roeDetail = `ROE ${roe.toFixed(1)}% — Sangat efisien mencetak laba bersih dari ekuitas pemegang saham.`;
  } else if (roe >= 10 && roe < 15) {
    scoreSum += 22;
    roeTone = 'green';
    roeDetail = `ROE ${roe.toFixed(1)}% — Profitabilitas di atas rata-rata pasar.`;
  } else if (roe > 0 && roe < 10) {
    scoreSum += 12;
    roeTone = 'amber';
    roeDetail = `ROE ${roe.toFixed(1)}% — Profitabilitas moderat, perlu dorongan efisiensi modal.`;
  } else {
    scoreSum += 0;
    roeTone = 'red';
    roeDetail = `ROE ${roe.toFixed(1)}% — Profitabilitas lemah / ekuitas tergerus rugi.`;
  }

  // 4. Market Cap & Liquidity (20%)
  let capTone: 'green' | 'amber' | 'red' = 'amber';
  let capDetail = '';
  if (capitalization >= 50_000_000_000_000 || value >= 20_000_000_000) {
    scoreSum += 20;
    capTone = 'green';
    capDetail = `Market Cap ${formatCompact(capitalization)} & Nilai Transaksi Harian ${formatCompact(value)} — Likuiditas sangat solid (Big Cap).`;
  } else if (capitalization >= 5_000_000_000_000 || value >= 3_000_000_000) {
    scoreSum += 15;
    capTone = 'green';
    capDetail = `Market Cap ${formatCompact(capitalization)} — Likuiditas cukup baik (Mid Cap).`;
  } else if (value >= 1_000_000_000) {
    scoreSum += 10;
    capTone = 'amber';
    capDetail = `Market Cap ${formatCompact(capitalization)} — Small Cap dengan transaksi mencukupi.`;
  } else {
    scoreSum += 3;
    capTone = 'red';
    capDetail = `Market Cap ${formatCompact(capitalization)} — Likuiditas rendah, rawan volatilitas tinggi.`;
  }

  const score = Math.round((scoreSum / totalWeight) * 100);
  const passed = score >= 60;
  const statusText = passed
    ? 'LOLOS SCREENING FUNDAMENTAL'
    : 'TIDAK LOLOS SCREENING FUNDAMENTAL';

  return {
    score,
    passed,
    statusText,
    perStatus: { label: 'Rasio P/E (PER)', tone: perTone, detail: perDetail },
    pbvStatus: { label: 'Rasio P/BV', tone: pbvTone, detail: pbvDetail },
    roeStatus: { label: 'Return on Equity (ROE)', tone: roeTone, detail: roeDetail },
    capStatus: { label: 'Kapitalisasi & Likuiditas', tone: capTone, detail: capDetail },
  };
}

export function evaluateTechnicalScreening(
  analysis: StockAnalysis,
  summary: StockSummary
): TechnicalScreeningResult {
  const { trendEma, indicators, volume, supportResistance } = analysis;

  let scoreSum = 0;

  // 1. Trend (30%)
  let trendTone: 'green' | 'amber' | 'red' = 'amber';
  let trendDetail = '';
  if (trendEma.trend === 'bullish') {
    scoreSum += 30;
    trendTone = 'green';
    trendDetail = `Struktur tren Bullish terkonfirmasi. Close (${formatRupiah(summary.lastClose)}) di atas EMA20 (${formatRupiah(trendEma.ema20)}) & EMA50.`;
  } else if (trendEma.trend === 'sideways') {
    scoreSum += 15;
    trendTone = 'amber';
    trendDetail = 'Struktur tren Sideways / Konsolidasi — menunggu penembusan arah.';
  } else {
    scoreSum += 0;
    trendTone = 'red';
    trendDetail = 'Struktur tren Bearish — harga berada di bawah tekanan EMA20 & EMA50.';
  }

  // 2. Momentum RSI & MACD (30%)
  let momTone: 'green' | 'amber' | 'red' = 'amber';
  let momDetail = '';
  const isMacdBull =
    indicators.macdSignalType === 'bullish' || indicators.macdSignalType === 'bullish_crossover';
  const isRsiBull = indicators.rsi14 >= 50 && indicators.rsi14 <= 70;
  if (isMacdBull && isRsiBull) {
    scoreSum += 30;
    momTone = 'green';
    momDetail = `Momentum sangat kuat. MACD Bullish & RSI 14 di ${indicators.rsi14.toFixed(1)} (Zona Emas Accumulation).`;
  } else if (isMacdBull) {
    scoreSum += 20;
    momTone = 'green';
    momDetail = `MACD memberikan sinyal bullish crossover, RSI di ${indicators.rsi14.toFixed(1)}.`;
  } else if (indicators.rsi14 < 30) {
    scoreSum += 15;
    momTone = 'amber';
    momDetail = `RSI Oversold (${indicators.rsi14.toFixed(1)}) — berpotensi technical rebound.`;
  } else if (indicators.rsi14 > 70) {
    scoreSum += 10;
    momTone = 'amber';
    momDetail = `RSI Overbought (${indicators.rsi14.toFixed(1)}) — rawan aksi profit taking.`;
  } else {
    scoreSum += 5;
    momTone = 'red';
    momDetail = 'Momentum teknikal masih cenderung lemah / bearish.';
  }

  // 3. Volume & RVOL (20%)
  let volTone: 'green' | 'amber' | 'red' = 'amber';
  let volDetail = '';
  if (volume.isHighVolume && volume.relativeVolume >= 1.5) {
    scoreSum += 20;
    volTone = 'green';
    volDetail = `Volume transaksi sangat masif (RVOL ${volume.relativeVolume.toFixed(2)}×) — transaksi institusi/smart money aktif.`;
  } else if (volume.isHighVolume) {
    scoreSum += 15;
    volTone = 'green';
    volDetail = `Volume transaksi di atas rata-rata (RVOL ${volume.relativeVolume.toFixed(2)}×).`;
  } else {
    scoreSum += 8;
    volTone = 'amber';
    volDetail = `Volume transaksi cenderung normal/rendah (RVOL ${Number.isNaN(volume.relativeVolume) ? '–' : volume.relativeVolume.toFixed(2)}×).`;
  }

  // 4. Jarak ke Resistance (20%)
  let resTone: 'green' | 'amber' | 'red' = 'amber';
  let resDetail = '';
  const r1 = supportResistance.resistances[0];
  if (r1) {
    const upsidePct = ((r1.price - summary.lastClose) / summary.lastClose) * 100;
    if (upsidePct >= 8) {
      scoreSum += 20;
      resTone = 'green';
      resDetail = `Ruang kenaikan sangat luas. Resistance ${r1.label} (${formatRupiah(r1.price)}) berjarak +${upsidePct.toFixed(1)}%.`;
    } else if (upsidePct >= 3) {
      scoreSum += 14;
      resTone = 'green';
      resDetail = `Potensi upside +${upsidePct.toFixed(1)}% menuju resistance ${r1.label} (${formatRupiah(r1.price)}).`;
    } else {
      scoreSum += 4;
      resTone = 'red';
      resDetail = `Harga sudah mendekati resistance ${r1.label} (${formatRupiah(r1.price)}) — potensi naik terbatas (+${upsidePct.toFixed(1)}%).`;
    }
  } else {
    scoreSum += 20;
    resTone = 'green';
    resDetail = 'Breakout All-Time High / Tidak ada resistance terdekat di atas harga.';
  }

  const score = Math.round(scoreSum);
  const passed = score >= 60;
  const statusText = passed
    ? 'LOLOS SCREENING TEKNIKAL'
    : 'TIDAK LOLOS SCREENING TEKNIKAL';

  return {
    score,
    passed,
    statusText,
    trendStatus: { label: 'Arah Tren & EMA', tone: trendTone, detail: trendDetail },
    momentumStatus: { label: 'Momentum MACD & RSI', tone: momTone, detail: momDetail },
    volumeStatus: { label: 'Konfirmasi Volume (RVOL)', tone: volTone, detail: volDetail },
    resistanceStatus: { label: 'Potensi Upside vs Resistance', tone: resTone, detail: resDetail },
  };
}

export function computeAiStockAdvisor(
  summary: StockSummary,
  analysis: StockAnalysis,
  newsSummary: NewsSentimentSummary,
  breakoutScores: BreakoutScores,
  freshness?: DataFreshness | null
): {
  advisor: AiStockAdvisor;
  fundamentalScreening: FundamentalScreeningResult;
  technicalScreening: TechnicalScreeningResult;
} {
  const fundScreening = evaluateFundamentalScreening(summary);
  const techScreening = evaluateTechnicalScreening(analysis, summary);
  const newsScore = newsSummary.netSentimentScore;
  const breakoutScore = breakoutScores.composite;

  // Composite Score weighting: Technical 35%, Fundamental 30%, Breakout 20%, News 15%
  const compositeScore = Math.round(
    techScreening.score * 0.35 +
    fundScreening.score * 0.30 +
    breakoutScore * 0.20 +
    newsScore * 0.15
  );

  // Derive Verdict & Tone
  let verdict: AiVerdict = 'TAHAN';
  let verdictLabel = 'TAHAN / WATCHLIST';
  let verdictTone: 'green' | 'amber' | 'red' | 'blue' = 'amber';
  let confidenceScore = Math.min(95, Math.max(55, compositeScore + 10));

  if (compositeScore >= 78) {
    verdict = 'SANGAT_BELI';
    verdictLabel = 'SANGAT LAYAK BELI (STRONG BUY)';
    verdictTone = 'green';
  } else if (compositeScore >= 62) {
    verdict = 'BELI';
    verdictLabel = 'LAYAK BELI (ACCUMULATE BUY)';
    verdictTone = 'green';
  } else if (compositeScore >= 45) {
    verdict = 'TAHAN';
    verdictLabel = 'NEUTRAL / TAHAN (WATCHLIST)';
    verdictTone = 'amber';
  } else {
    verdict = 'HINDARI';
    verdictLabel = 'HINDARI / BERISIKOI (AVOID / SELL)';
    verdictTone = 'red';
  }

  // Compile "Reasons to Buy" (Alasan Mengapa Harus Membeli)
  const buyReasons: string[] = [];

  if (fundScreening.passed) {
    buyReasons.push(
      `Fundamental Solid (Skor ${fundScreening.score}/100): ${fundScreening.perStatus.detail} ${fundScreening.roeStatus.detail}`
    );
  } else if (summary.per > 0 && summary.per <= 15) {
    buyReasons.push(`Valuasi PER tergolong murah di level ${summary.per.toFixed(1)}×.`);
  }

  if (techScreening.passed) {
    buyReasons.push(
      `Teknikal Bullish (Skor ${techScreening.score}/100): Tren ${analysis.trendEma.trend.toUpperCase()}, Close (${formatRupiah(summary.lastClose)}) di atas EMA20.`
    );
  } else if (analysis.trendEma.trend === 'bullish') {
    buyReasons.push(`Struktur pergerakan harga berada dalam tren naik (Bullish Trend).`);
  }

  if (analysis.volume.isHighVolume) {
    buyReasons.push(
      `Lonjakan Volume Akumulasi (RVOL ${analysis.volume.relativeVolume.toFixed(2)}×) mengindikasikan kehadiran Smart Money.`
    );
  }

  if (newsSummary.overallSentiment === 'bullish') {
    buyReasons.push(
      `Sentimen Berita Positif (${newsSummary.netSentimentScore}% Skor Bullish) memberikan katalis penggerak harga.`
    );
  }

  if (breakoutScores.status === 'BUY_WATCH' || breakoutScores.composite >= 70) {
    buyReasons.push(
      `Breakout Hunter AI memberikan skor tinggi (${breakoutScores.composite}/100) dengan probabilitas naik >10% sebesar ${breakoutScores.probUp}%.`
    );
  }

  if (analysis.indicators.macdSignalType === 'bullish_crossover') {
    buyReasons.push('Sinyal MACD Bullish Crossover baru saja terbentuk — sinyal awal momentum naik.');
  }

  if (buyReasons.length === 0) {
    buyReasons.push('Saham memiliki potensi rebound jika terjadi penembusan support kunci dengan volume tinggi.');
  }

  // Compile "Reasons to Avoid" (Alasan Mengapa Harus Menghindari)
  const avoidReasons: string[] = [];

  if (!fundScreening.passed) {
    avoidReasons.push(
      `Fundamental Belum Optimal (Skor ${fundScreening.score}/100): ${fundScreening.perStatus.detail} ${fundScreening.roeStatus.detail}`
    );
  } else if (summary.per > 30) {
    avoidReasons.push(`Valuasi PER cukup tinggi (${summary.per.toFixed(1)}×) — berisiko jika pertumbuhan laba melambat.`);
  }

  if (!techScreening.passed) {
    avoidReasons.push(
      `Teknikal Belum Kategori Lolos (Skor ${techScreening.score}/100): Tren masih ${analysis.trendEma.trend} atau di bawah EMA20.`
    );
  } else if (analysis.trendEma.trend === 'bearish') {
    avoidReasons.push('Arah tren utama masih Bearish — hindari menangkap pisau jatuh (catching falling knife).');
  }

  if (analysis.indicators.rsi14 > 70) {
    avoidReasons.push(
      `RSI 14 di ${analysis.indicators.rsi14.toFixed(1)} memasuki zona Overbought — rawan profit taking jangka pendek.`
    );
  }

  const r1 = analysis.supportResistance.resistances[0];
  if (r1) {
    const upsidePct = ((r1.price - summary.lastClose) / summary.lastClose) * 100;
    if (upsidePct <= 2.0) {
      avoidReasons.push(
        `Jarak ke Resistance ${r1.label} (${formatRupiah(r1.price)}) sangat dekat (+${upsidePct.toFixed(1)}%) — risk/reward kurang ideal.`
      );
    }
  }

  if (breakoutScores.distributionRisk >= 50) {
    avoidReasons.push(
      `Risiko Distribusi AI (Distribution Risk: ${breakoutScores.distributionRisk}/100) mengindikasikan potensi tekanan jual institusi.`
    );
  }

  if (newsSummary.overallSentiment === 'bearish') {
    avoidReasons.push(
      `Sentimen Berita Tertekan (${newsSummary.bearishCount} berita negatif) dapat membendung apresiasi harga.`
    );
  }

  if (avoidReasons.length === 0) {
    avoidReasons.push('Tetap patuhi Stop Loss disiplin untuk mengantisipasi gejolak pasar atau pembalikan tren mendadak.');
  }

  const isStaleData = freshness?.tier === 'stale';
  if (isStaleData && freshness) {
    avoidReasons.unshift(
      `Data Tidak Real-time (Stale): Harga terakhir tercatat ${freshness.ageInTradingDays} hari bursa lalu — kondisi pasar saat ini bisa sudah jauh berbeda dari analisis di atas.`
    );
  }

  // Executive Summary
  const executiveSummary =
    `Berdasarkan kombinasi screening fundamental (Skor: ${fundScreening.score}/100), screening teknikal (Skor: ${techScreening.score}/100), sentimen berita pasar (${newsScore}%), dan Breakout Hunter Score (${breakoutScore}/100), emiten ${summary.ticker} memperoleh skor komposit ${compositeScore}/100. ` +
    (verdict === 'SANGAT_BELI' || verdict === 'BELI'
      ? `Saham ini menunjukkan kombinasi yang menarik antara dorongan teknikal dan katalis pendukung. Ideal dimanfaatkan untuk strategi swing trading dengan konfirmasi volume.`
      : verdict === 'TAHAN'
        ? `Saham ini berada dalam kondisi sinyal campuran. Disarankan masuk watchlist dan menunggu konfirmasi breakout level resistance kunci atau kejelasan tren.`
        : `Saham ini memiliki risiko teknikal/fundamental yang perlu diwaspadai. Disarankan menunda keputusan entry hingga terbentuk pola pembalikan arah yang valid.`);

  const tradingRecommendation = isStaleData
    ? `Data harga terakhir sudah ${freshness!.ageInTradingDays} hari bursa berlalu — jangan gunakan Entry/TP/SL di bawah ini untuk keputusan Day Trading atau ARA hari ini. Verifikasi harga & volume real-time terlebih dahulu sebelum bertindak; analisis ini hanya relevan untuk konteks Swing/Position.`
    : verdict === 'SANGAT_BELI' || verdict === 'BELI'
      ? `Gunakan area Entry di sekitar ${formatRupiah(analysis.tradingPlan.bullish.entry)} dengan Target Profit 1 di ${formatRupiah(analysis.tradingPlan.bullish.tp1)} (+${(((analysis.tradingPlan.bullish.tp1 - summary.lastClose) / summary.lastClose) * 100).toFixed(1)}%) dan Stop Loss ketat di ${formatRupiah(analysis.tradingPlan.bullish.sl)}.`
      : verdict === 'TAHAN'
        ? `Pantau penembusan resistance ${formatRupiah(analysis.supportResistance.resistances[0]?.price || summary.lastClose * 1.05)} untuk konfirmasi sinyal beli.`
        : `Hindari pembelian impulsif. Tunggu harga menembus di atas EMA20 (${formatRupiah(analysis.trendEma.ema20)}) serta kembalinya volume beli.`;

  const advisor: AiStockAdvisor = {
    verdict,
    verdictLabel,
    verdictTone,
    confidenceScore,
    compositeScore,
    fundamentalScore: fundScreening.score,
    technicalScore: techScreening.score,
    newsScore,
    breakoutScore,
    buyReasons,
    avoidReasons,
    executiveSummary,
    tradingRecommendation,
  };

  return { advisor, fundamentalScreening: fundScreening, technicalScreening: techScreening };
}
