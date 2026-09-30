/**
 * signalMock.ts
 *
 * TEMPORARY mock data for the /signal dashboard. Values are illustrative only —
 * not real signals. Replace by pointing `SignalRepository` at the real API;
 * the UI only depends on the types in `domain/models/Signal.ts`.
 */

import {
  ScoreFactor,
  ScoreFactorKey,
  SignalAction,
  SignalPattern,
  SignalPerformanceSummary,
  SignalReason,
  StockSignal,
  TradePlan,
} from '@/domain/models/Signal';
import { roundToTick } from '@/domain/analysis/idxTick';

/** Composite weights (sum = 1). */
const WEIGHTS: Record<ScoreFactorKey, number> = {
  trend: 0.2,
  momentum: 0.15,
  volume: 0.15,
  smartMoney: 0.15,
  pattern: 0.15,
  fundamental: 0.1,
  marketRisk: 0.1,
};

type FactorTuple = [trend: number, momentum: number, volume: number, smartMoney: number, pattern: number, fundamental: number, marketRisk: number];

const FACTOR_ORDER: ScoreFactorKey[] = ['trend', 'momentum', 'volume', 'smartMoney', 'pattern', 'fundamental', 'marketRisk'];

const FACTOR_NOTES: Record<ScoreFactorKey, [strong: string, mid: string, weak: string]> = {
  trend: ['Harga di atas EMA200, struktur higher-high', 'Trend sideways, EMA mendatar', 'Harga di bawah EMA200, downtrend'],
  momentum: ['EMA8 > EMA18, RSI di zona kuat', 'Momentum netral', 'Momentum melemah, RSI turun'],
  volume: ['Volume jauh di atas rata-rata 20 hari', 'Volume mendekati rata-rata', 'Volume sepi, minim partisipasi'],
  smartMoney: ['Akumulasi asing/broker besar', 'Aliran dana campuran', 'Distribusi oleh broker besar'],
  pattern: ['Pola valid dengan konfirmasi', 'Pola belum terkonfirmasi', 'Pola bearish / gagal'],
  fundamental: ['Laba tumbuh, valuasi wajar', 'Fundamental rata-rata', 'Fundamental lemah / mahal'],
  marketRisk: ['IHSG mendukung, risiko pasar rendah', 'Pasar netral', 'Tekanan pasar tinggi'],
};

function buildBreakdown(f: FactorTuple): ScoreFactor[] {
  return FACTOR_ORDER.map((key, i) => {
    const score = f[i];
    const [strong, mid, weak] = FACTOR_NOTES[key];
    return { key, score, weight: WEIGHTS[key], note: score >= 70 ? strong : score >= 50 ? mid : weak };
  });
}

function composite(f: FactorTuple): number {
  return Math.round(FACTOR_ORDER.reduce((sum, key, i) => sum + f[i] * WEIGHTS[key], 0));
}

interface Seed {
  ticker: string;
  companyName: string;
  sector: string;
  price: number;
  changePct: number;
  action: SignalAction;
  pattern: SignalPattern;
  factors: FactorTuple;
  confidence: number;
  plan: Omit<TradePlan, 'riskReward'> | null;
  reasons: Array<[label: string, factor: ScoreFactorKey, passed: boolean]>;
  risks: string[];
  buyAllowed: boolean;
  trigger: string;
  explanation: string;
}

const SEEDS: Seed[] = [
  {
    ticker: 'BBRI', companyName: 'Bank Rakyat Indonesia (Persero) Tbk', sector: 'Keuangan', price: 4_250, changePct: 2.41,
    action: 'BUY', pattern: 'Breakout', factors: [88, 82, 86, 84, 85, 80, 62], confidence: 82,
    plan: { entryLow: 4_180, entryHigh: 4_280, tp1: 4_500, tp2: 4_700, stopLoss: 4_060, holdingPeriod: '1–5 Hari' },
    reasons: [['Price > EMA200', 'trend', true], ['EMA8 > EMA18', 'momentum', true], ['Momentum candle', 'momentum', true], ['Volume 2,1x rata-rata', 'volume', true], ['Foreign accumulation', 'smartMoney', true], ['Breakout resistance 4.200', 'pattern', true], ['RSI 61', 'momentum', true]],
    risks: ['Resistance berikutnya 4.400', 'Market trend netral'],
    buyAllowed: true, trigger: 'Close > 4.280 + Volume > 1,5x',
    explanation: 'BBRI menembus resistance 4.200 dengan volume 2,1x rata-rata dan didukung akumulasi asing. Trend jangka panjang masih naik (di atas EMA200) dan momentum jangka pendek searah. Entry paling aman di area 4.180–4.280 selama volume tetap tinggi.',
  },
  {
    ticker: 'ADRO', companyName: 'Alamtri Resources Indonesia Tbk', sector: 'Energi', price: 2_720, changePct: 3.02,
    action: 'BUY', pattern: 'Momentum', factors: [84, 86, 80, 76, 78, 74, 58], confidence: 78,
    plan: { entryLow: 2_660, entryHigh: 2_740, tp1: 2_900, tp2: 3_020, stopLoss: 2_590, holdingPeriod: '1–5 Hari' },
    reasons: [['Price > EMA200', 'trend', true], ['EMA8 > EMA18', 'momentum', true], ['Momentum candle', 'momentum', true], ['Volume 1,8x rata-rata', 'volume', true], ['Broker besar akumulasi', 'smartMoney', true], ['RSI 66', 'momentum', true]],
    risks: ['RSI mendekati overbought', 'Harga komoditas batubara volatil'],
    buyAllowed: true, trigger: 'Close > 2.740 + Volume > 1,5x',
    explanation: 'ADRO sedang dalam fase momentum: tiga hari berturut-turut ditutup naik dengan volume di atas rata-rata. Skor turun sedikit karena RSI mulai tinggi, jadi ukuran posisi sebaiknya lebih kecil dan disiplin pada stop loss.',
  },
  {
    ticker: 'TLKM', companyName: 'Telkom Indonesia (Persero) Tbk', sector: 'Infrastruktur', price: 3_060, changePct: -0.65,
    action: 'BUY_ON_WEAKNESS', pattern: 'Pullback', factors: [78, 62, 58, 72, 74, 82, 64], confidence: 71,
    plan: { entryLow: 2_980, entryHigh: 3_030, tp1: 3_180, tp2: 3_280, stopLoss: 2_920, holdingPeriod: '3–10 Hari' },
    reasons: [['Price > EMA200', 'trend', true], ['Pullback ke EMA50', 'pattern', true], ['Foreign net buy 5 hari', 'smartMoney', true], ['Fundamental solid', 'fundamental', true], ['Volume belum konfirmasi', 'volume', false]],
    risks: ['Entry hanya di area bawah, jangan kejar harga', 'Volume pullback masih sedang'],
    buyAllowed: true, trigger: 'Harga menyentuh 2.980–3.030 lalu close hijau',
    explanation: 'TLKM masih uptrend, tetapi harga saat ini sedang koreksi sehat menuju EMA50. Sinyal ini meminta Anda menunggu harga turun ke zona entry, bukan membeli di harga sekarang.',
  },
  {
    ticker: 'ANTM', companyName: 'Aneka Tambang Tbk', sector: 'Barang Baku', price: 1_645, changePct: 1.54,
    action: 'BUY', pattern: 'Breakout', factors: [76, 78, 88, 70, 80, 66, 60], confidence: 74,
    plan: { entryLow: 1_610, entryHigh: 1_660, tp1: 1_760, tp2: 1_840, stopLoss: 1_565, holdingPeriod: '1–5 Hari' },
    reasons: [['Price > EMA200', 'trend', true], ['EMA8 > EMA18', 'momentum', true], ['Volume 2,6x rata-rata', 'volume', true], ['Breakout konsolidasi 3 minggu', 'pattern', true], ['Asing masih net sell', 'smartMoney', false]],
    risks: ['Asing belum ikut masuk', 'Sensitif terhadap harga emas & nikel'],
    buyAllowed: true, trigger: 'Close > 1.660 + Volume > 1,5x',
    explanation: 'ANTM keluar dari konsolidasi 3 minggu dengan lonjakan volume 2,6x. Minusnya, dana asing belum ikut masuk sehingga confidence tidak setinggi BBRI.',
  },
  {
    ticker: 'BBCA', companyName: 'Bank Central Asia Tbk', sector: 'Keuangan', price: 9_875, changePct: 0.25,
    action: 'HOLD', pattern: 'Consolidation', factors: [74, 55, 50, 66, 55, 88, 62], confidence: 66,
    plan: { entryLow: 9_700, entryHigh: 9_850, tp1: 10_300, tp2: 10_600, stopLoss: 9_500, holdingPeriod: 'Hold posisi' },
    reasons: [['Price > EMA200', 'trend', true], ['Fundamental premium', 'fundamental', true], ['Momentum datar', 'momentum', false], ['Volume di bawah rata-rata', 'volume', false]],
    risks: ['Belum ada katalis breakout', 'Range sempit 9.700–10.000'],
    buyAllowed: false, trigger: 'Close > 10.000 untuk entry baru',
    explanation: 'BBCA masih sehat secara trend dan fundamental, sehingga pemegang posisi bisa tetap hold. Untuk posisi baru, tunggu harga keluar dari range 9.700–10.000.',
  },
  {
    ticker: 'ASII', companyName: 'Astra International Tbk', sector: 'Industri', price: 5_150, changePct: -0.48,
    action: 'WAIT', pattern: 'Consolidation', factors: [60, 52, 48, 55, 58, 72, 60], confidence: 58,
    plan: { entryLow: 5_050, entryHigh: 5_150, tp1: 5_400, tp2: 5_550, stopLoss: 4_950, holdingPeriod: '3–10 Hari' },
    reasons: [['Price > EMA200', 'trend', true], ['EMA8 < EMA18', 'momentum', false], ['Volume sepi', 'volume', false], ['Valuasi murah', 'fundamental', true]],
    risks: ['Momentum belum berbalik', 'Resistance kuat 5.300'],
    buyAllowed: false, trigger: 'Close > 5.300 + Volume > 1,5x',
    explanation: 'ASII murah secara valuasi, tetapi momentum dan volume belum mendukung. Tunggu konfirmasi breakout 5.300 sebelum entry.',
  },
  {
    ticker: 'GOTO', companyName: 'GoTo Gojek Tokopedia Tbk', sector: 'Teknologi', price: 68, changePct: -2.86,
    action: 'SELL', pattern: 'Breakdown', factors: [28, 32, 64, 30, 26, 38, 55], confidence: 72,
    plan: null,
    reasons: [['Price < EMA200', 'trend', false], ['EMA8 < EMA18', 'momentum', false], ['Breakdown support 70', 'pattern', false], ['Distribusi broker besar', 'smartMoney', false]],
    risks: ['Support berikutnya 62', 'Tekanan jual dengan volume tinggi'],
    buyAllowed: false, trigger: 'Tidak ada entry — tunggu close > 72',
    explanation: 'GOTO menembus support 70 ke bawah dengan volume tinggi dan distribusi broker besar. Pemegang posisi sebaiknya menerapkan cut loss; belum ada alasan untuk entry.',
  },
  {
    ticker: 'PTBA', companyName: 'Bukit Asam Tbk', sector: 'Energi', price: 2_890, changePct: 0.7,
    action: 'BUY_ON_WEAKNESS', pattern: 'Pullback', factors: [72, 60, 56, 68, 70, 78, 58], confidence: 67,
    plan: { entryLow: 2_820, entryHigh: 2_860, tp1: 3_000, tp2: 3_100, stopLoss: 2_760, holdingPeriod: '3–10 Hari' },
    reasons: [['Price > EMA200', 'trend', true], ['Retest breakout lama', 'pattern', true], ['Dividend yield tinggi', 'fundamental', true], ['Volume menurun', 'volume', false]],
    risks: ['Harga sekarang di atas zona entry', 'Sentimen batubara'],
    buyAllowed: true, trigger: 'Harga turun ke 2.820–2.860 lalu bertahan',
    explanation: 'PTBA sedang retest area breakout sebelumnya. Peluang terbaik ada saat harga turun ke zona entry, bukan di harga sekarang.',
  },
  {
    ticker: 'UNVR', companyName: 'Unilever Indonesia Tbk', sector: 'Konsumen Primer', price: 1_890, changePct: -1.3,
    action: 'NO_TRADE', pattern: 'Consolidation', factors: [34, 40, 38, 42, 40, 48, 58], confidence: 61,
    plan: null,
    reasons: [['Price < EMA200', 'trend', false], ['Momentum lemah', 'momentum', false], ['Volume sepi', 'volume', false], ['Pola belum jelas', 'pattern', false]],
    risks: ['Downtrend jangka panjang', 'Tidak ada setup valid'],
    buyAllowed: false, trigger: 'Tidak ada trigger — belum ada setup',
    explanation: 'UNVR tidak memiliki setup yang valid: trend turun, volume sepi, dan pola belum terbentuk. Lebih baik dilewati.',
  },
  {
    ticker: 'MDKA', companyName: 'Merdeka Copper Gold Tbk', sector: 'Barang Baku', price: 2_310, changePct: 4.05,
    action: 'WAIT', pattern: 'Reversal', factors: [48, 74, 82, 60, 66, 44, 58], confidence: 60,
    plan: { entryLow: 2_250, entryHigh: 2_320, tp1: 2_480, tp2: 2_580, stopLoss: 2_170, holdingPeriod: '1–5 Hari' },
    reasons: [['Price < EMA200', 'trend', false], ['EMA8 cross EMA18', 'momentum', true], ['Volume 2,3x rata-rata', 'volume', true], ['Bullish engulfing', 'pattern', true]],
    risks: ['Masih di bawah EMA200', 'Rawan false reversal'],
    buyAllowed: false, trigger: 'Close > 2.400 (EMA200) + Volume > 1,5x',
    explanation: 'MDKA menunjukkan tanda awal reversal dengan volume besar, tetapi harga masih di bawah EMA200. Tunggu konfirmasi di atas 2.400 agar risiko false reversal lebih kecil.',
  },
  {
    ticker: 'ICBP', companyName: 'Indofood CBP Sukses Makmur Tbk', sector: 'Konsumen Primer', price: 11_350, changePct: 0.89,
    action: 'BUY', pattern: 'Pullback', factors: [80, 72, 66, 70, 76, 84, 62], confidence: 73,
    plan: { entryLow: 11_150, entryHigh: 11_400, tp1: 11_900, tp2: 12_300, stopLoss: 10_900, holdingPeriod: '3–10 Hari' },
    reasons: [['Price > EMA200', 'trend', true], ['EMA8 > EMA18', 'momentum', true], ['Pantulan dari EMA50', 'pattern', true], ['Laba tumbuh', 'fundamental', true], ['RSI 57', 'momentum', true]],
    risks: ['Volume pantulan masih sedang'],
    buyAllowed: true, trigger: 'Close > 11.400',
    explanation: 'ICBP memantul dari EMA50 dalam uptrend yang rapi, didukung fundamental kuat. Setup ini lebih cocok untuk swing beberapa hari.',
  },
  {
    ticker: 'BMRI', companyName: 'Bank Mandiri (Persero) Tbk', sector: 'Keuangan', price: 5_725, changePct: -0.43,
    action: 'HOLD', pattern: 'Consolidation', factors: [70, 54, 52, 62, 56, 80, 62], confidence: 63,
    plan: { entryLow: 5_600, entryHigh: 5_700, tp1: 6_000, tp2: 6_200, stopLoss: 5_450, holdingPeriod: 'Hold posisi' },
    reasons: [['Price > EMA200', 'trend', true], ['Fundamental kuat', 'fundamental', true], ['Momentum datar', 'momentum', false]],
    risks: ['Menunggu katalis laporan keuangan'],
    buyAllowed: false, trigger: 'Close > 5.900 untuk entry baru',
    explanation: 'BMRI masih dalam trend naik jangka panjang namun bergerak sideways. Pertahankan posisi, entry baru setelah breakout 5.900.',
  },
];

function roundRR(plan: Omit<TradePlan, 'riskReward'>): number {
  const entryMid = (plan.entryLow + plan.entryHigh) / 2;
  const risk = entryMid - plan.stopLoss;
  return risk > 0 ? Math.round(((plan.tp1 - entryMid) / risk) * 10) / 10 : 0;
}

export function buildMockSignals(date: string): StockSignal[] {
  return SEEDS.map((s) => ({
    id: `${date}-${s.ticker}`,
    ticker: s.ticker,
    companyName: s.companyName,
    sector: s.sector,
    price: s.price,
    changePct: s.changePct,
    date,
    action: s.action,
    pattern: s.pattern,
    saraScore: composite(s.factors),
    confidence: s.confidence,
    tradePlan: s.plan ? { ...s.plan, riskReward: roundRR(s.plan) } : null,
    reasons: s.reasons.map(([label, factor, passed]): SignalReason => ({ label, factor, passed })),
    risks: s.risks,
    decision: { buyAllowed: s.buyAllowed, trigger: s.trigger },
    explanation: s.explanation,
    scoreBreakdown: buildBreakdown(s.factors),
  }));
}

export const MOCK_PERFORMANCE: SignalPerformanceSummary = {
  totalSignals: 146,
  winRate: 58.2,
  avgReturn: 2.4,
  activeSignals: 9,
  periodLabel: '30 hari terakhir',
};

/** Indonesian-formatted numbers ("4.200", "11.400", "70", "2,1") not glued to a word like "EMA200". */
const NUM_IN_TEXT = /(?<![A-Za-z\d.,])\d{1,3}(?:\.\d{3})+(?![\d,])|(?<![A-Za-z\d.,])\d+(?:,\d+)?(?![\d.])/g;

/**
 * Re-anchors a mock signal onto the real EOD quote: sets price/change and scales
 * every price level (trade plan + price numbers in the copy) by real/mock so the
 * entry zone, targets and triggers stay coherent with the price actually shown.
 */
export function rebaseMockSignal(signal: StockSignal, price: number, changePct: number): StockSignal {
  const base = signal.price;
  if (!(price > 0) || !(base > 0)) return signal;
  const ratio = price / base;
  const scale = (v: number) => roundToTick(v * ratio);
  const scaleText = (text: string) =>
    text.replace(NUM_IN_TEXT, (m) => {
      if (m.includes(',')) return m; // multipliers / decimals, not price levels
      const v = Number(m.replace(/\./g, ''));
      return v >= base * 0.6 && v <= base * 1.6 ? scale(v).toLocaleString('id-ID') : m;
    });

  const plan = signal.tradePlan;
  const scaledPlan = plan && {
    entryLow: scale(plan.entryLow), entryHigh: scale(plan.entryHigh),
    tp1: scale(plan.tp1), tp2: scale(plan.tp2), stopLoss: scale(plan.stopLoss),
    holdingPeriod: plan.holdingPeriod,
  };

  return {
    ...signal,
    price,
    changePct,
    tradePlan: scaledPlan ? { ...scaledPlan, riskReward: roundRR(scaledPlan) } : null,
    reasons: signal.reasons.map((r) => ({ ...r, label: scaleText(r.label) })),
    risks: signal.risks.map(scaleText),
    decision: { ...signal.decision, trigger: scaleText(signal.decision.trigger) },
    explanation: scaleText(signal.explanation),
  };
}
