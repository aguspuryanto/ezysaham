/**
 * promptBuilders.ts
 *
 * Builds the [INPUT DATA] user prompt for each AI report kind served by
 * src/app/api/ai-chat/route.ts (system prompts in src/lib/aiPrompts.ts).
 * Selected from docs/features_prompt_ai.md — only prompts whose data the app
 * actually has. Every number the model may quote is computed here; missing
 * values are written as "N/A" so the model reports them as unavailable
 * instead of guessing.
 */

import { BandarScoreResult } from '@/domain/analysis/bandarScore';
import { FundamentalScreeningResult, TechnicalScreeningResult } from '@/domain/analysis/aiStockEngine';
import { roundToTick } from '@/domain/analysis/idxTick';
import { SmartMoneyMeasures } from '@/domain/analysis/smartMoneyHunter';
import { BrokerActivityDetail, BrokerSummaryRow, SmartMoneyFlows } from '@/domain/models/BrokerSummary';
import { FundamentalDetail } from '@/domain/models/Fundamentals';
import { OHLCVBar } from '@/domain/models/History';
import { NewsSentimentSummary } from '@/domain/models/News';
import { StockSummary } from '@/domain/models/Stock';
import { StockAnalysis } from '@/domain/models/StockAnalysis';
import { closes, sma } from '@/domain/indicators/movingAverages';
import { formatCompact } from '@/lib/format';

export type AiReportKind = 'research' | 'trading-plan' | 'bandar' | 'foreign' | 'valuation' | 'compare';

// ─── Formatting ───────────────────────────────────────────────────────────────
const NA = 'N/A';
const has = (n: number | null | undefined): n is number => n != null && Number.isFinite(n);
const rp = (n: number | null | undefined) => (has(n) && n > 0 ? `Rp${Math.round(n).toLocaleString('id-ID')}` : NA);
const pct = (n: number | null | undefined, dec = 1) => (has(n) ? `${n >= 0 ? '+' : ''}${n.toFixed(dec)}%` : NA);
const num = (n: number | null | undefined, dec = 1, suffix = '') => (has(n) ? `${n.toFixed(dec)}${suffix}` : NA);
const idr = (n: number | null | undefined) => (has(n) ? `${n >= 0 ? '+' : ''}Rp${formatCompact(n)}` : NA);
/** Pasardana reports missing PER/PBV/ROE as 0 or negative — not a real ratio. */
const ratio = (n: number, dec = 1, suffix = 'x') => (n > 0 ? `${n.toFixed(dec)}${suffix}` : NA);

function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** % change of close over the last `sessions` bars. */
function changeOver(bars: OHLCVBar[], sessions: number): number | null {
  if (bars.length <= sessions) return null;
  const from = bars[bars.length - 1 - sessions].close;
  return from > 0 ? ((bars[bars.length - 1].close - from) / from) * 100 : null;
}

function header(summary: StockSummary): string {
  return `[KODE_SAHAM]: ${summary.ticker} — ${summary.name}
Sektor: ${summary.sector} / ${summary.subSector}
Harga Saat Ini: ${rp(summary.lastClose)} (${pct(summary.percentChange1D, 2)} hari ini)`;
}

// ─── Research report (existing) ───────────────────────────────────────────────
export interface ResearchInput {
  summary: StockSummary;
  analysis: StockAnalysis;
  fundamentals: FundamentalDetail | null;
  newsSummary: NewsSentimentSummary;
  fundamentalScreening: FundamentalScreeningResult;
  technicalScreening: TechnicalScreeningResult;
}

export function buildResearchPrompt({ summary, analysis, fundamentals, newsSummary, fundamentalScreening, technicalScreening }: ResearchInput): string {
  const { trendEma, indicators, volume, supportResistance, tradingPlan } = analysis;
  const nearestResistance = supportResistance.resistances[0];
  const nearestSupport = supportResistance.supports[0];
  const bias = tradingPlan.recommendedBias === 'bearish' ? 'bearish' : 'bullish';
  const scenario = tradingPlan[bias];

  return `${header(summary)}

=== TEKNIKAL ===
- Tren: ${trendEma.trend} — ${trendEma.trendDescription}
- EMA20: Rp${trendEma.ema20.toFixed(0)} | EMA50: Rp${trendEma.ema50.toFixed(0)} | EMA200: Rp${trendEma.ema200.toFixed(0)}
- Harga vs EMA20: ${trendEma.priceVsEma20} | vs EMA50: ${trendEma.priceVsEma50}
- RSI14: ${indicators.rsi14.toFixed(1)} (${indicators.rsiZone}) — ${indicators.rsiNote}
- MACD: value ${indicators.macdValue.toFixed(2)}, signal ${indicators.macdSignal.toFixed(2)} → ${indicators.macdSignalType}
- Resistance Terdekat: ${nearestResistance ? `Rp${nearestResistance.price.toFixed(0)} (${nearestResistance.label})` : 'tidak terdeteksi'}
- Support Terdekat: ${nearestSupport ? `Rp${nearestSupport.price.toFixed(0)} (${nearestSupport.label})` : 'tidak terdeteksi'}
- RVOL (Relative Volume): ${volume.relativeVolume.toFixed(2)}x, tren volume ${volume.volumeTrend}

=== FUNDAMENTAL ===
- PER: ${ratio(summary.per)} (status valuasi: ${fundamentalScreening.perStatus.tone})
- PBV: ${ratio(summary.pbv, 2)}
- ROE: ${summary.roe !== 0 ? `${summary.roe.toFixed(1)}%` : NA}
- Market Cap: ${formatCompact(summary.capitalization)}
- Dividend Yield: ${num(fundamentals?.dividendYield, 1, '%')}
- Debt to Equity: ${num(fundamentals?.debtToEquity, 1, '%')}
- Net Margin: ${num(fundamentals?.netMargin, 1, '%')}
- Revenue Growth YoY: ${num(fundamentals?.revenueGrowth, 1, '%')}

=== SENTIMEN BERITA ===
- Total Berita: ${newsSummary.totalNews} (Bullish ${newsSummary.bullishCount} / Bearish ${newsSummary.bearishCount} / Netral ${newsSummary.neutralCount})
- Sentimen Keseluruhan: ${newsSummary.overallSentiment} (skor bersih ${newsSummary.netSentimentScore}/100)

=== SKOR SCREENING INTERNAL (referensi tambahan) ===
- Skor Fundamental: ${fundamentalScreening.score}/100 — ${fundamentalScreening.statusText}
- Skor Teknikal: ${technicalScreening.score}/100 — ${technicalScreening.statusText}

=== RENCANA TRADING SISTEM (gunakan angka ini persis di tabel strategi) ===
- Bias: ${tradingPlan.recommendedBias}
- Entry: Rp${scenario.entry.toFixed(0)}
- TP1: Rp${scenario.tp1.toFixed(0)} | TP2: Rp${scenario.tp2.toFixed(0)}
- SL: Rp${scenario.sl.toFixed(0)}
- Risk/Reward: ${scenario.riskRewardRatio.toFixed(2)}
- Catatan Sistem: ${scenario.notes}

Susun laporan riset saham ${summary.ticker} sesuai format yang telah ditentukan.`;
}

// ─── Trading plan (prompt 26–30) ──────────────────────────────────────────────
export interface TradingPlanInput {
  summary: StockSummary;
  analysis: StockAnalysis;
  bars: OHLCVBar[];
}

/** Weekly closes (last bar of each Monday-based week), oldest first. */
function weeklyCloses(bars: OHLCVBar[]): number[] {
  const byWeek = new Map<string, number>();
  for (const bar of bars) {
    const d = new Date(`${bar.date.slice(0, 10)}T00:00:00Z`);
    const monday = new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * 864e5).toISOString().slice(0, 10);
    byWeek.set(monday, bar.close);
  }
  return [...byWeek.values()];
}

function weeklyTrendLine(bars: OHLCVBar[]): string {
  const weeks = weeklyCloses(bars);
  if (weeks.length < 10) return `data mingguan belum cukup (${weeks.length} minggu)`;
  const ma10 = sma(weeks, 10);
  const last = weeks[weeks.length - 1];
  const maNow = ma10[ma10.length - 1];
  const maPrev = ma10[ma10.length - 5];
  const slope = Number.isFinite(maPrev) && maPrev > 0 ? ((maNow - maPrev) / maPrev) * 100 : null;
  const last4 = weeks.slice(-5);
  const upWeeks = last4.slice(1).filter((c, i) => c > last4[i]).length;
  return `close mingguan ${rp(last)} ${last >= maNow ? 'di atas' : 'di bawah'} MA10-mingguan ${rp(maNow)}; kemiringan MA10 4 minggu ${pct(slope)}; ${upWeeks}/4 minggu terakhir ditutup naik`;
}

export function buildTradingPlanPrompt({ summary, analysis, bars }: TradingPlanInput): string {
  const { trendEma, indicators, volume, supportResistance, priceAction, tradingPlan } = analysis;
  const levels = (items: typeof supportResistance.supports) =>
    items.length ? items.map((l) => `${l.label} ${rp(l.price)} (${l.description})`).join('; ') : 'tidak terdeteksi';
  const scenario = (name: string, s: typeof tradingPlan.bullish) =>
    `- Skenario ${name} (${s.direction}, ${s.entryType}): Entry ${rp(s.entry)} | SL ${rp(s.sl)} | TP1 ${rp(s.tp1)} | TP2 ${rp(s.tp2)} | R:R 1:${s.riskRewardRatio.toFixed(2)} | Risiko ${num(s.riskPct)}% | Jarak entry dari harga ${num(s.entryDistancePct)}%
  Invalidasi: ${s.invalidationRule}${s.validationErrors.length ? ` | ⚠️ Validasi gagal: ${s.validationErrors.join('; ')}` : ''}
  Catatan: ${s.notes}`;
  const closes20 = closes(bars).slice(-20);

  return `${header(summary)}

=== TREN MULTI-TIMEFRAME ===
- Harian: ${trendEma.trend} — ${trendEma.trendDescription}. EMA20 ${rp(trendEma.ema20)}, EMA50 ${rp(trendEma.ema50)}, EMA200 ${rp(trendEma.ema200)}. Higher lows: ${trendEma.higherLows ? 'ya' : 'tidak'}
- Mingguan: ${weeklyTrendLine(bars)}
- Perubahan harga: 1M ${pct(summary.percentChange1M)} | 3M ${pct(summary.percentChange3M)} | 6M ${pct(summary.percentChange6M)} | 1Y ${pct(summary.percentChange1Y)} | 3Y ${pct(summary.percentChange3Y)}
- Rentang 52 minggu: ${rp(summary.annualLow)} – ${rp(summary.annualHigh)}
- Range 20 sesi terakhir: ${closes20.length ? `${rp(Math.min(...closes20))} – ${rp(Math.max(...closes20))}` : NA}

=== LEVEL KUNCI (dari sistem) ===
- Resistance: ${levels(supportResistance.resistances)}
- Support: ${levels(supportResistance.supports)}

=== MOMENTUM ===
- RSI14: ${num(indicators.rsi14)} (${indicators.rsiZone}) — ${indicators.rsiNote}
- MACD: ${num(indicators.macdValue, 2)} vs signal ${num(indicators.macdSignal, 2)}, histogram ${num(indicators.macdHistogram, 2)} → ${indicators.macdSignalType}. ${indicators.macdNote}
- Stochastic: %K ${num(indicators.stochK)} / %D ${num(indicators.stochD)} (${indicators.stochZone}) — ${indicators.stochNote}

=== PRICE ACTION & VOLUME ===
- Candle terakhir: ${priceAction.lastCandleColor}, pola ${priceAction.patternLabel}
- Catatan price action: ${priceAction.notes.join('; ') || '-'}
- RVOL: ${num(volume.relativeVolume, 2)}x (volume ${formatCompact(volume.lastVolume)} vs MA20 ${formatCompact(volume.volumeMa20)}), tren volume ${volume.volumeTrend}
- Catatan volume: ${volume.notes.join('; ') || '-'}

=== RENCANA TRADING SISTEM (pakai angka ini persis) ===
- Bias yang direkomendasikan sistem: ${tradingPlan.recommendedBias}
${scenario('Bullish', tradingPlan.bullish)}
${scenario('Bearish', tradingPlan.bearish)}

Susun trading plan ${summary.ticker} sesuai format.`;
}

// ─── Bandarmology (prompt 17–20) ──────────────────────────────────────────────
export interface BandarInput {
  summary: StockSummary;
  bars: OHLCVBar[];
  bandarScore: BandarScoreResult;
  brokerActivity: BrokerActivityDetail | null;
  flows: SmartMoneyFlows | null;
  measures: SmartMoneyMeasures | null;
}

function brokerTable(rows: BrokerSummaryRow[] | null | undefined, side: 'buy' | 'sell', limit = 5): string {
  if (!rows?.length) return '  (data tidak tersedia)';
  const sorted = [...rows].sort((a, b) => (side === 'buy' ? b.netValue - a.netValue : a.netValue - b.netValue));
  const picked = sorted.filter((r) => (side === 'buy' ? r.netValue > 0 : r.netValue < 0)).slice(0, limit);
  if (!picked.length) return '  (tidak ada)';
  return picked
    .map((r) => `  - ${r.code}: net ${idr(r.netValue)} | buy ${idr(r.buyValue)} @avg ${rp(r.buyAvg)} | sell ${idr(r.sellValue)} @avg ${rp(r.sellAvg)} | freq ${r.buyFreq}/${r.sellFreq}`)
    .join('\n');
}

function wyckoffBlock(bandarScore: BandarScoreResult): string {
  return `=== PROXY WYCKOFF (harga + volume + OBV, bukan data broker) ===
- Skor: ${bandarScore.total}/${bandarScore.max} — ${bandarScore.classification.label} (${bandarScore.phaseLabel})
- Hidden distribution (harga naik, OBV melemah): ${bandarScore.hiddenDistributionWarning ? 'YA' : 'tidak'}
${bandarScore.factors.map((f) => `- ${f.label} ${f.score}/${f.max}: ${f.detail}`).join('\n')}`;
}

export function buildBandarPrompt({ summary, bars, bandarScore, brokerActivity, flows, measures }: BandarInput): string {
  const parts = [header(summary), `Perubahan harga: 5 sesi ${pct(changeOver(bars, 5))} | 20 sesi ${pct(changeOver(bars, 20))}`];

  if (brokerActivity) {
    parts.push(`=== BROKER SUMMARY TERAKHIR (${brokerActivity.rangeFrom} s/d ${brokerActivity.rangeTo}) ===
Top Buyer:
${brokerTable(brokerActivity.topBuyers, 'buy')}
Top Seller:
${brokerTable(brokerActivity.topSellers, 'sell')}
Net foreign periode ini: ${idr(brokerActivity.foreignFlow?.netForeign)}`);
  } else {
    parts.push('=== BROKER SUMMARY TERAKHIR ===\n(data tidak tersedia)');
  }

  if (flows) {
    parts.push(`=== BROKER SUMMARY 5 SESI (${flows.from5} s/d ${flows.asOf}) ===
Net Buyer:
${brokerTable(flows.broker5, 'buy')}
Net Seller:
${brokerTable(flows.broker5, 'sell')}

=== BROKER SUMMARY 20 SESI (${flows.from20} s/d ${flows.asOf}) ===
Net Buyer:
${brokerTable(flows.broker20, 'buy')}
Net Seller:
${brokerTable(flows.broker20, 'sell')}

Net foreign: 5 sesi ${idr(flows.foreign5?.netForeign)} | 20 sesi ${idr(flows.foreign20?.netForeign)}`);
  } else {
    parts.push('=== BROKER SUMMARY 5 & 20 SESI ===\n(data tidak tersedia)');
  }

  if (measures) {
    parts.push(`=== METRIK SMART MONEY (sistem) ===
- Broker net buyer terbesar 5 sesi: ${measures.brokerTopCode ?? NA} (${idr(measures.brokerTopNet)}), porsi ${has(measures.brokerTopShare) ? `${(measures.brokerTopShare * 100).toFixed(0)}%` : NA} dari total nilai beli semua broker
- Imbalance (Σ net buy 3 broker teratas ÷ |Σ net sell 3 broker terbawah|): ${num(measures.brokerImbalance, 2, 'x')}
- Broker teratas konsisten di 5 & 20 sesi: ${measures.brokerConsistent == null ? NA : measures.brokerConsistent ? 'ya' : 'tidak'}
- Rata-rata nilai transaksi 20 hari: ${idr(measures.adtv20)}`);
  }

  parts.push(wyckoffBlock(bandarScore), `Analisa bandarmology ${summary.ticker} sesuai format.`);
  return parts.join('\n\n');
}

// ─── Foreign flow (prompt 22, 24, 25) ─────────────────────────────────────────
export interface ForeignInput {
  summary: StockSummary;
  bars: OHLCVBar[];
  brokerActivity: BrokerActivityDetail | null;
  flows: SmartMoneyFlows | null;
  measures: SmartMoneyMeasures | null;
  fundamentals: FundamentalDetail | null;
  newsSummary: NewsSentimentSummary;
}

export function buildForeignPrompt({ summary, bars, brokerActivity, flows, measures, fundamentals, newsSummary }: ForeignInput): string {
  const daily = flows?.foreignDaily.length
    ? flows.foreignDaily.map((d) => `  - ${d.date}: ${d.netForeign == null ? NA : idr(d.netForeign)}`).join('\n')
    : '  (data harian tidak tersedia)';
  const intensity = measures && has(measures.foreignNet5) && has(measures.value5) && measures.value5 > 0
    ? `${((measures.foreignNet5 / measures.value5) * 100).toFixed(1)}% dari nilai transaksi 5 sesi`
    : NA;

  return `${header(summary)}
Kapitalisasi pasar: Rp${formatCompact(summary.capitalization)} | Free float: ${num(summary.freeFloat, 1, '%')}

=== FOREIGN FLOW ===
- Periode broker summary terakhir (${brokerActivity ? `${brokerActivity.rangeFrom} s/d ${brokerActivity.rangeTo}` : NA}): buy ${idr(brokerActivity?.foreignFlow?.foreignBuy)} | sell ${idr(brokerActivity?.foreignFlow?.foreignSell)} | net ${idr(brokerActivity?.foreignFlow?.netForeign)}
- 5 sesi${flows ? ` (${flows.from5} s/d ${flows.asOf})` : ''}: buy ${idr(flows?.foreign5?.foreignBuy)} | sell ${idr(flows?.foreign5?.foreignSell)} | net ${idr(flows?.foreign5?.netForeign)}
- 20 sesi${flows ? ` (${flows.from20} s/d ${flows.asOf})` : ''}: buy ${idr(flows?.foreign20?.foreignBuy)} | sell ${idr(flows?.foreign20?.foreignSell)} | net ${idr(flows?.foreign20?.netForeign)}
- Hari net buy asing: ${measures && has(measures.foreignBuyDays) && has(measures.foreignDays) ? `${measures.foreignBuyDays} dari ${measures.foreignDays} hari` : NA}
- Intensitas net foreign: ${intensity}
- Net foreign harian:
${daily}

=== PERGERAKAN HARGA (periode yang sama) ===
- 5 sesi: ${pct(changeOver(bars, 5))} | 20 sesi: ${pct(changeOver(bars, 20))} | 3 bulan: ${pct(summary.percentChange3M)} | 1 tahun: ${pct(summary.percentChange1Y)}

=== FUNDAMENTAL RINGKAS ===
- PER ${ratio(summary.per)} | PBV ${ratio(summary.pbv, 2)} | ROE ${summary.roe !== 0 ? `${summary.roe.toFixed(1)}%` : NA}
- Pertumbuhan laba YoY ${num(fundamentals?.earningsGrowth, 1, '%')} | Net margin ${num(fundamentals?.netMargin, 1, '%')} | DER ${num(fundamentals?.debtToEquity, 1, '%')}

=== SENTIMEN BERITA ===
- ${newsSummary.totalNews} berita (Bullish ${newsSummary.bullishCount} / Bearish ${newsSummary.bearishCount} / Netral ${newsSummary.neutralCount}), sentimen ${newsSummary.overallSentiment}

Analisa foreign flow ${summary.ticker} sesuai format.`;
}

// ─── Valuation (prompt 11, 14, 15) ────────────────────────────────────────────
export interface ValuationInput {
  summary: StockSummary;
  fundamentals: FundamentalDetail | null;
  allSummaries: StockSummary[];
  /** % yield SBN 10 tahun; null when not configured. */
  sbn10yYield: number | null;
}

interface ValuationScenario {
  name: string;
  growth: number;
  per: number;
  target: number;
  upside: number;
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Three-case target from trailing EPS (price / PER), growth and a PER multiple — computed here, not by the model. */
export function valuationScenarios(price: number, per: number, sectorPer: number | null, earningsGrowth: number | null): ValuationScenario[] | null {
  if (!(price > 0) || !(per > 0)) return null;
  const eps = price / per;
  const refPer = sectorPer && sectorPer > 0 ? sectorPer : per;
  const base = clamp(earningsGrowth ?? 0, -20, 25);
  const cases = [
    { name: 'Pesimistis', growth: base - 10, per: Math.min(per, refPer) * 0.9 },
    { name: 'Basis', growth: base, per: (per + refPer) / 2 },
    { name: 'Optimistis', growth: base + 10, per: Math.max(per, refPer) },
  ];
  return cases.map((c) => {
    const target = roundToTick(eps * (1 + c.growth / 100) * c.per);
    return { ...c, target, upside: ((target - price) / price) * 100 };
  });
}

export function buildValuationPrompt({ summary, fundamentals, allSummaries, sbn10yYield }: ValuationInput): string {
  // Sub-sector peers are the fairer yardstick (bank vs multifinance), when there are enough of them.
  const subPeers = allSummaries.filter((s) => s.subSector === summary.subSector && s.ticker !== summary.ticker && s.per > 0);
  const useSub = subPeers.length >= 5;
  const peerGroup = useSub ? `sub-sektor ${summary.subSector}` : `sektor ${summary.sector}`;
  const peers = allSummaries.filter((s) => (useSub ? s.subSector === summary.subSector : s.sector === summary.sector) && s.ticker !== summary.ticker);
  const sectorPer = median(peers.map((s) => s.per).filter((v) => v > 0 && v < 200));
  const sectorPbv = median(peers.map((s) => s.pbv).filter((v) => v > 0 && v < 50));
  const sectorRoe = median(peers.map((s) => s.roe).filter((v) => v !== 0));
  const earningsYield = summary.per > 0 ? 100 / summary.per : null;
  const scenarios = valuationScenarios(summary.lastClose, summary.per, sectorPer, fundamentals?.earningsGrowth ?? null);

  const scenarioBlock = scenarios
    ? `- EPS trailing (harga / PER): Rp${(summary.lastClose / summary.per).toFixed(1)}
- Pertumbuhan laba dasar: ${has(fundamentals?.earningsGrowth) ? `${pct(fundamentals.earningsGrowth)} YoY kuartal terakhir, dibatasi -20%..+25% untuk skenario Basis` : 'data tidak tersedia, skenario Basis memakai asumsi 0%'}
${scenarios.map((s) => `- ${s.name}: pertumbuhan laba ${pct(s.growth)} | PER asumsi ${s.per.toFixed(1)}x | target implisit ${rp(s.target)} | potensi ${pct(s.upside)}`).join('\n')}
- Metode: target = EPS × (1 + pertumbuhan) × PER asumsi. PER Pesimistis = 90% dari yang lebih rendah antara PER saham dan median ${peerGroup}; Basis = rata-rata keduanya; Optimistis = yang lebih tinggi.`
    : '- Skenario tidak dihitung: PER saham N/A atau negatif (laba rugi), sehingga metode PER tidak berlaku.';

  return `${header(summary)}

=== VALUASI RELATIF (${peers.length} emiten pembanding di ${peerGroup}) ===
- PER: ${ratio(summary.per)} vs median ${sectorPer ? `${sectorPer.toFixed(1)}x` : NA}
- PBV: ${ratio(summary.pbv, 2)} vs median ${sectorPbv ? `${sectorPbv.toFixed(2)}x` : NA}
- ROE: ${summary.roe !== 0 ? `${summary.roe.toFixed(1)}%` : NA} vs median ${sectorRoe != null ? `${sectorRoe.toFixed(1)}%` : NA}
- Rata-rata historis PER/PBV 5 tahun: data tidak tersedia

=== EARNINGS YIELD ===
- Earnings yield (1/PER): ${earningsYield != null ? `${earningsYield.toFixed(2)}%` : NA}
- Yield SBN 10 tahun: ${sbn10yYield != null ? `${sbn10yYield.toFixed(2)}%` : 'data tidak tersedia'}
- Selisih (equity risk premium kasar): ${earningsYield != null && sbn10yYield != null ? `${(earningsYield - sbn10yYield).toFixed(2)} poin persen` : NA}

=== KUALITAS ===
- Net margin ${num(fundamentals?.netMargin, 1, '%')} | DER ${num(fundamentals?.debtToEquity, 1, '%')} | Current ratio ${num(fundamentals?.currentRatio, 2)}
- Pertumbuhan pendapatan YoY ${num(fundamentals?.revenueGrowth, 1, '%')} | Pertumbuhan laba YoY ${num(fundamentals?.earningsGrowth, 1, '%')}
- Dividend yield ${num(fundamentals?.dividendYield, 1, '%')} | Payout ratio ${num(fundamentals?.dividendPayoutRatio, 1, '%')}

=== SKENARIO VALUASI (dihitung sistem — pakai angka ini persis) ===
${scenarioBlock}

Susun analisa valuasi ${summary.ticker} sesuai format.`;
}

// ─── Peer comparison (prompt 41) ──────────────────────────────────────────────
export interface CompareSide {
  summary: StockSummary;
  fundamentals: FundamentalDetail | null;
}

export function buildComparePrompt(sides: CompareSide[]): string {
  const block = ({ summary: s, fundamentals: f }: CompareSide) => `=== ${s.ticker} — ${s.name} ===
- Sektor: ${s.sector} / ${s.subSector}
- Harga: ${rp(s.lastClose)} | Market cap: Rp${formatCompact(s.capitalization)}
- Pertumbuhan pendapatan YoY: ${num(f?.revenueGrowth, 1, '%')} | Pertumbuhan laba YoY: ${num(f?.earningsGrowth, 1, '%')}
- Net margin: ${num(f?.netMargin, 1, '%')} | ROE: ${s.roe !== 0 ? `${s.roe.toFixed(1)}%` : NA}
- DER: ${num(f?.debtToEquity, 1, '%')} | Current ratio: ${num(f?.currentRatio, 2)}
- PER: ${ratio(s.per)} | PBV: ${ratio(s.pbv, 2)}
- Dividend yield: ${num(f?.dividendYield, 1, '%')} | Payout ratio: ${num(f?.dividendPayoutRatio, 1, '%')}
- Kinerja harga: 1M ${pct(s.percentChange1M)} | 1Y ${pct(s.percentChange1Y)} | 3Y ${pct(s.percentChange3Y)}`;

  return `${sides.map(block).join('\n\n')}

Bandingkan ${sides.map((s) => s.summary.ticker).join(' vs ')} sesuai format.`;
}
