/**
 * todayMoveAnalysis.ts
 *
 * "TODAY MOVE ANALYSIS" — explains WHAT CHANGED TODAY (vs previous close) and WHY, before any
 * technical read. Rules it enforces:
 *  - Compare today vs the previous session first: price change, OHLC, volume vs prev/average,
 *    RVOL, range expansion, close position.
 *  - Classify the move explicitly (NORMAL / PRICE-VOLUME / BREAKOUT / ACCUMULATION / EVENT /
 *    REOPENING / UNKNOWN). A large event (corporate action, suspension/reopening) always outranks
 *    the technical classification.
 *  - Never invent a cause: every catalyst line is tagged FAKTA (from price/volume data or a direct,
 *    current news item that names the event), INDIKASI (circumstantial: direct news without an
 *    event keyword, broker/foreign flow) or BELUM TERVERIFIKASI.
 *  - A +20–35% day is "EXPLOSIVE MOVE TERDETEKSI", not a bullish setup by itself — the trade status
 *    is capped separately ("ENTRY MASIH LAYAK" only when the base 10-second review allows it AND
 *    chase/event risk is not high).
 *
 * Like tenSecondReview.ts, this never recomputes Entry/SL/TP or the Risk Gate — the caller passes
 * the already-derived base status so the two cards can never disagree in the permissive direction.
 */

import { formatRupiah } from '@/lib/format';
import { OHLCVBar } from '@/domain/models/History';
import { StockSummary } from '@/domain/models/Stock';
import { StockNewsItem } from '@/domain/models/News';
import { BrokerActivityDetail } from '@/domain/models/BrokerSummary';
import { FundamentalRiskLevel } from '@/domain/analysis/riskGate';
import { ReviewStatus } from '@/domain/analysis/tenSecondReview';
import { closes, ema, lastValid } from '@/domain/indicators/movingAverages';

export type MoveType =
  | 'NORMAL'
  | 'PRICE_VOLUME_EXPANSION'
  | 'BREAKOUT'
  | 'ACCUMULATION'
  | 'EVENT'
  | 'REOPENING'
  | 'UNKNOWN';

export const MOVE_TYPE_LABEL: Record<MoveType, string> = {
  NORMAL: 'NORMAL MOVE',
  PRICE_VOLUME_EXPANSION: 'PRICE-VOLUME EXPANSION',
  BREAKOUT: 'BREAKOUT',
  ACCUMULATION: 'ACCUMULATION',
  EVENT: 'EVENT / CORPORATE ACTION',
  REOPENING: 'REOPENING / SUSPENSION EVENT',
  UNKNOWN: 'UNKNOWN / CATALYST NOT VERIFIED',
};

export type CatalystStatus = 'VERIFIED' | 'SUSPECTED' | 'NOT_FOUND';
export const CATALYST_STATUS_LABEL: Record<CatalystStatus, string> = {
  VERIFIED: 'Verified',
  SUSPECTED: 'Suspected',
  NOT_FOUND: 'Not Found',
};

/** FAKTA = data/official-news backed · INDIKASI = circumstantial · BELUM_TERVERIFIKASI = no source. */
export type EvidenceKind = 'FAKTA' | 'INDIKASI' | 'BELUM_TERVERIFIKASI';
export interface CatalystEvidence {
  kind: EvidenceKind;
  text: string;
  url?: string;
}

export type RiskLevel3 = 'LOW' | 'MEDIUM' | 'HIGH';
export type TodayTradeStatus = 'BUY' | 'WAIT' | 'NO_TRADE';
export const TODAY_TRADE_STATUS_LABEL: Record<TodayTradeStatus, string> = {
  BUY: 'BUY',
  WAIT: 'WAIT',
  NO_TRADE: 'NO TRADE',
};

export interface TodayMoveInput {
  summary: StockSummary;
  bars: OHLCVBar[];
  newsItems: StockNewsItem[];
  brokerActivity: BrokerActivityDetail | null;
  trend: 'bullish' | 'bearish' | 'sideways';
  ema50: number;
  ema200: number;
  rsi14: number;
  macdSignalType: 'bullish_crossover' | 'bullish' | 'bearish_crossover' | 'bearish' | 'neutral';
  macdHistogram: number;
  support: number | null;
  resistance: number | null;
  fundamentalRisk: FundamentalRiskLevel;
  isStrongDistribution: boolean;
  isDistributionRisk: boolean;
  hiddenDistribution: boolean;
  /** Status from tenSecondReview.ts (Risk Gate + entry confirmation) — this only ever caps it. */
  baseStatus: ReviewStatus;
  /** Setup description from tenSecondReview.ts, reused as "what to wait for". */
  baseScenario: string;
}

export interface TodayMoveAnalysis {
  // Price & volume
  prevClose: number;
  close: number;
  open: number | null;
  high: number;
  low: number;
  changePct: number;
  volume: number;
  prevVolume: number | null;
  volumeChangePct: number | null;
  avgVolume20: number | null;
  rvol: number | null;
  /** Today's range ÷ average range of the prior 14 sessions. */
  rangeExpansion: number | null;
  /** 0 = closed at the low, 1 = closed at the high. */
  closePosition: number | null;
  gapPct: number | null;
  /** Calendar days between the previous bar and today's bar (large → suspension/holiday gap). */
  sessionGapDays: number | null;

  moveType: MoveType;
  moveTypeReason: string;
  explosive: boolean;

  catalystStatus: CatalystStatus;
  catalystSummary: string;
  evidence: CatalystEvidence[];

  // Technical
  trendLabel: string;
  momentumLabel: string;
  rsiLabel: string;
  macdLabel: string;
  ema200Label: string;
  ema9: number | null;
  ema21: number | null;
  support: number | null;
  resistance: number | null;

  // Risk
  chaseRisk: RiskLevel3;
  chaseRiskNote: string;
  eventRisk: RiskLevel3;
  eventRiskNote: string;
  primaryTrendRisk: RiskLevel3;
  primaryTrendRiskNote: string;
  otherRisks: string[];

  // Trade status
  tradeStatus: TodayTradeStatus;
  buyPermission: 'YES' | 'NO' | 'CONDITIONAL';
  entryStatus: string;

  conclusion: string;
}

const EVENT_KEYWORDS: { kw: string; label: string }[] = [
  { kw: 'rights issue', label: 'Rights Issue' },
  { kw: 'right issue', label: 'Rights Issue' },
  { kw: 'hmetd', label: 'Rights Issue (HMETD)' },
  { kw: 'private placement', label: 'Private Placement' },
  { kw: 'tanpa hmetd', label: 'Private Placement (PMTHMETD)' },
  { kw: 'pmthmetd', label: 'Private Placement (PMTHMETD)' },
  { kw: 'stock split', label: 'Stock Split' },
  { kw: 'pemecahan saham', label: 'Stock Split' },
  { kw: 'reverse stock', label: 'Reverse Stock Split' },
  { kw: 'penggabungan saham', label: 'Reverse Stock Split' },
  { kw: 'tender offer', label: 'Tender Offer' },
  { kw: 'penawaran tender', label: 'Tender Offer' },
  { kw: 'akuisisi', label: 'Akuisisi' },
  { kw: 'diakuisisi', label: 'Akuisisi' },
  { kw: 'pengendali baru', label: 'Perubahan Pengendali' },
  { kw: 'merger', label: 'Merger' },
  { kw: 'backdoor', label: 'Backdoor Listing' },
  { kw: 'buyback', label: 'Buyback' },
  { kw: 'pembelian kembali saham', label: 'Buyback' },
  { kw: 'dividen', label: 'Dividen' },
  { kw: 'rups', label: 'RUPS' },
  { kw: 'keterbukaan informasi', label: 'Keterbukaan Informasi' },
];

const REOPEN_KEYWORDS = [
  'dibuka kembali', 'pembukaan kembali', 'membuka kembali', 'cabut suspensi', 'pencabutan suspensi',
  'unsuspend', 'kembali diperdagangkan', 'perdagangan kembali',
];
const SUSPENSION_KEYWORDS = [
  'suspensi', 'disuspensi', 'penghentian sementara', 'penghentian perdagangan', 'gembok',
  'uma', 'unusual market activity', 'notasi khusus', 'cooling down',
];

/** Calendar-day gap between bars above which the previous session is treated as a halt, not a weekend/holiday. */
const SUSPENSION_GAP_DAYS = 7;

function rp(n: number | null): string {
  return n != null && n > 0 ? formatRupiah(n) : '–';
}
function pct(n: number | null, dec = 1): string {
  if (n == null || Number.isNaN(n)) return '–';
  return `${n >= 0 ? '+' : ''}${n.toFixed(dec)}%`;
}
function x(n: number | null): string {
  return n == null || Number.isNaN(n) ? '–' : `${n.toFixed(2)}×`;
}
function newsText(n: StockNewsItem): string {
  return `${n.title} ${n.snippet}`.toLowerCase();
}
function hasWord(text: string, kw: string): boolean {
  // Short keywords (uma, rups) must match as whole words so "umat"/"rupslb" noise doesn't count twice.
  return kw.length <= 4 ? new RegExp(`\\b${kw}\\b`).test(text) : text.includes(kw);
}
function daysBetween(a: string, b: string): number | null {
  const ta = Date.parse(a);
  const tb = Date.parse(b);
  if (Number.isNaN(ta) || Number.isNaN(tb)) return null;
  return Math.round(Math.abs(tb - ta) / 86_400_000);
}

export function buildTodayMoveAnalysis(i: TodayMoveInput): TodayMoveAnalysis {
  const { summary, bars } = i;
  const close = summary.lastClose;

  // ── Align today's bar. EOD history can lag the summary by one session: if the last bar's close
  // doesn't match the summary, today's bar isn't in history yet and the last bar is "previous".
  const last = bars[bars.length - 1];
  const lastIsToday = last != null && close > 0 && Math.abs(last.close - close) / close < 0.005;
  const todayIdx = lastIsToday ? bars.length - 1 : bars.length; // bars.length = not in history
  const prevBar = bars[todayIdx - 1] ?? null;
  const todayBar = lastIsToday ? last : null;

  const prevClose = summary.prevClose > 0 ? summary.prevClose : prevBar?.close ?? close;
  const changePct = prevClose > 0 ? ((close - prevClose) / prevClose) * 100 : summary.percentChange1D;
  const high = summary.high > 0 ? summary.high : todayBar?.high ?? close;
  const low = summary.low > 0 ? summary.low : todayBar?.low ?? close;
  const open = todayBar?.open ?? null;
  const volume = summary.volume > 0 ? summary.volume : todayBar?.volume ?? 0;
  const prevVolume = prevBar?.volume ?? null;
  const volumeChangePct = prevVolume != null && prevVolume > 0 ? ((volume - prevVolume) / prevVolume) * 100 : null;

  const prior = bars.slice(0, todayIdx);
  const prior20 = prior.slice(-20).filter((b) => b.volume > 0);
  const avgVolume20 = prior20.length >= 5 ? prior20.reduce((s, b) => s + b.volume, 0) / prior20.length : null;
  const rvol = avgVolume20 != null && avgVolume20 > 0 && volume > 0 ? volume / avgVolume20 : null;

  const prior14 = prior.slice(-14).filter((b) => b.high > b.low);
  const avgRange = prior14.length >= 5 ? prior14.reduce((s, b) => s + (b.high - b.low), 0) / prior14.length : null;
  const todayRange = high - low;
  const rangeExpansion = avgRange != null && avgRange > 0 ? todayRange / avgRange : null;
  const closePosition = todayRange > 0 ? (close - low) / todayRange : null;
  const gapPct = open != null && prevClose > 0 ? ((open - prevClose) / prevClose) * 100 : null;

  // Suspension evidence from data: a long calendar gap before today, or a run of zero-volume bars.
  const sessionGapDays = todayBar && prevBar ? daysBetween(prevBar.date, todayBar.date) : null;
  const recentZeroVolume = prior.slice(-5).filter((b) => b.volume === 0).length;
  const dataSuspensionGap = (sessionGapDays != null && sessionGapDays > SUSPENSION_GAP_DAYS) || recentZeroVolume >= 3;

  // 20-session high before today — the breakout reference.
  const prior20High = prior.slice(-20).reduce((m, b) => Math.max(m, b.high), 0);

  // ── News scan: only DIRECT (names this company) and current (≤7 hari) news counts as a fact.
  const direct = i.newsItems.filter((n) => n.relevance === 'DIRECT' || n.relevance == null);
  const current = direct.filter((n) => n.ageBucket === 'CURRENT');
  const recentOrUnknown = direct.filter((n) => n.ageBucket === 'RECENT' || n.ageBucket === 'UNKNOWN');
  const findEvent = (items: StockNewsItem[]) => {
    for (const n of items) {
      const t = newsText(n);
      const hit = EVENT_KEYWORDS.find((k) => hasWord(t, k.kw));
      if (hit) return { item: n, label: hit.label };
    }
    return null;
  };
  const reopenNews = current.find((n) => REOPEN_KEYWORDS.some((k) => hasWord(newsText(n), k)));
  const suspensionNews = current.find((n) => SUSPENSION_KEYWORDS.some((k) => hasWord(newsText(n), k)));
  const eventNews = findEvent(current);
  const olderEventNews = eventNews ? null : findEvent(recentOrUnknown);

  // ── Evidence list: FAKTA / INDIKASI / BELUM TERVERIFIKASI.
  const evidence: CatalystEvidence[] = [];
  if (dataSuspensionGap) {
    evidence.push({
      kind: 'FAKTA',
      text: sessionGapDays != null && sessionGapDays > SUSPENSION_GAP_DAYS
        ? `Data harga kosong ${sessionGapDays} hari sebelum sesi ini — pola khas suspensi lalu dibuka kembali.`
        : `${recentZeroVolume} dari 5 sesi terakhir tanpa transaksi (volume 0) — indikasi saham sempat disuspensi.`,
    });
  }
  if (reopenNews) evidence.push({ kind: 'FAKTA', text: `Berita pembukaan kembali perdagangan: "${reopenNews.title}" (${reopenNews.publisher}).`, url: reopenNews.url });
  if (suspensionNews && suspensionNews !== reopenNews) evidence.push({ kind: 'FAKTA', text: `Berita regulator (UMA/suspensi): "${suspensionNews.title}" (${suspensionNews.publisher}).`, url: suspensionNews.url });
  if (eventNews) evidence.push({ kind: 'FAKTA', text: `${eventNews.label}: "${eventNews.item.title}" (${eventNews.item.publisher}).`, url: eventNews.item.url });
  if (olderEventNews) evidence.push({ kind: 'INDIKASI', text: `${olderEventNews.label} (berita >7 hari/tanpa tanggal): "${olderEventNews.item.title}" — belum pasti jadi pemicu hari ini.`, url: olderEventNews.item.url });

  const otherCurrent = current.filter((n) => n !== reopenNews && n !== suspensionNews && n !== eventNews?.item);
  if (otherCurrent.length > 0) {
    const n = otherCurrent[0];
    evidence.push({ kind: 'INDIKASI', text: `Berita perusahaan terbaru: "${n.title}" (${n.publisher}) — kaitannya dengan pergerakan belum terverifikasi.`, url: n.url });
  }

  const flow = i.brokerActivity;
  let flowSupportsMove = false;
  if (flow) {
    const netForeign = flow.foreignFlow?.netForeign ?? null;
    const topBuy = flow.topBuyers[0];
    if (netForeign != null && netForeign !== 0) {
      const dir = netForeign > 0 ? 'Net Foreign Buy' : 'Net Foreign Sell';
      evidence.push({ kind: 'INDIKASI', text: `${dir} Rp${Math.abs(netForeign).toLocaleString('id-ID')} (${flow.rangeFrom}–${flow.rangeTo}).` });
      if ((netForeign > 0) === (changePct > 0)) flowSupportsMove = true;
    }
    if (topBuy && topBuy.netValue > 0) {
      evidence.push({ kind: 'INDIKASI', text: `Broker net buy terbesar: ${topBuy.code} (net Rp${topBuy.netValue.toLocaleString('id-ID')}).` });
      if (changePct > 0) flowSupportsMove = true;
    }
  }

  const bigMove = Math.abs(changePct) >= 5;
  const explosive = changePct >= 10;
  const volExpansion = rvol != null && rvol >= 2;
  const volAbove = rvol != null && rvol >= 1.5;
  const rangeExpanded = rangeExpansion != null && rangeExpansion >= 1.5;

  // ── Move type. Events first — technicals never override them.
  let moveType: MoveType;
  let moveTypeReason: string;
  if (dataSuspensionGap || reopenNews) {
    moveType = 'REOPENING';
    moveTypeReason = 'Pergerakan terjadi setelah saham tidak diperdagangkan (suspensi) — harga sedang mencari keseimbangan baru, bukan sinyal teknikal biasa.';
  } else if (eventNews) {
    moveType = 'EVENT';
    moveTypeReason = `Ada ${eventNews.label} dalam berita ≤7 hari terakhir — pergerakan harus dibaca sebagai reaksi event, bukan pola teknikal.`;
  } else if (explosive && volExpansion) {
    moveType = 'PRICE_VOLUME_EXPANSION';
    moveTypeReason = `Harga ${pct(changePct)} dengan volume ${x(rvol)} rata-rata — ekspansi harga & volume serentak.`;
  } else if (changePct > 0 && prior20High > 0 && close > prior20High && volAbove) {
    moveType = 'BREAKOUT';
    moveTypeReason = `Close ${rp(close)} menembus high 20 hari ${rp(prior20High)} dengan RVOL ${x(rvol)}.`;
  } else if (bigMove && volExpansion && rangeExpanded) {
    moveType = 'PRICE_VOLUME_EXPANSION';
    moveTypeReason = `Harga ${pct(changePct)}, RVOL ${x(rvol)}, range ${x(rangeExpansion)} dari normal.`;
  } else if (Math.abs(changePct) < 3 && volAbove && (closePosition ?? 0) >= 0.6) {
    moveType = 'ACCUMULATION';
    moveTypeReason = `Volume ${x(rvol)} rata-rata tapi harga relatif tertahan (${pct(changePct)}) dan close di area atas range — indikasi akumulasi.`;
  } else if (bigMove) {
    moveType = 'UNKNOWN';
    moveTypeReason = `Harga ${pct(changePct)} tanpa ekspansi volume/pemicu yang jelas — penyebab belum diketahui.`;
  } else {
    moveType = 'NORMAL';
    moveTypeReason = `Perubahan ${pct(changePct)} dengan RVOL ${x(rvol)} — masih dalam rentang pergerakan wajar.`;
  }

  // ── Catalyst status.
  const hasFact = evidence.some((e) => e.kind === 'FAKTA');
  const hasIndication = evidence.some((e) => e.kind === 'INDIKASI');
  const catalystStatus: CatalystStatus = hasFact ? 'VERIFIED' : hasIndication && (bigMove || volAbove) ? 'SUSPECTED' : 'NOT_FOUND';
  if (!hasFact && (bigMove || volExpansion)) {
    evidence.push({ kind: 'BELUM_TERVERIFIKASI', text: 'Tidak ditemukan corporate action, keterbukaan informasi, atau berita suspensi yang menjelaskan pergerakan ini. Cek keterbukaan informasi IDX secara manual.' });
  }
  const catalystSummary =
    moveType === 'REOPENING'
      ? 'Pergerakan dipicu pembukaan kembali perdagangan setelah suspensi.'
      : moveType === 'EVENT' && eventNews
        ? `Pergerakan bertepatan dengan ${eventNews.label} (berita langsung ≤7 hari).`
        : catalystStatus === 'SUSPECTED'
          ? `Belum ada pemicu resmi. Indikasi: ${flowSupportsMove ? 'aliran dana broker/asing searah pergerakan' : 'ada berita perusahaan terbaru'} — belum terbukti sebagai penyebab.`
          : bigMove || volExpansion
            ? 'Penyebab pergerakan belum ditemukan — jangan menebak pemicunya.'
            : 'Tidak ada pergerakan besar yang perlu dijelaskan pemicunya.';

  // ── Technical reads (EMA9/21 computed here; EMA50/200 from the engine).
  const cl = closes(bars);
  const ema9Raw = lastValid(ema(cl, 9));
  const ema21Raw = lastValid(ema(cl, 21));
  const ema9 = Number.isNaN(ema9Raw) ? null : ema9Raw;
  const ema21 = Number.isNaN(ema21Raw) ? null : ema21Raw;
  const aboveEma200 = i.ema200 > 0 && close > i.ema200;
  const emaStack = ema9 != null && ema21 != null
    ? ema9 > ema21 && ema21 > i.ema50 ? 'EMA9 > EMA21 > EMA50 (tersusun naik)'
      : ema9 < ema21 && ema21 < i.ema50 ? 'EMA9 < EMA21 < EMA50 (tersusun turun)'
        : 'EMA9/21/50 belum tersusun rapi'
    : 'EMA9/21 belum cukup data';
  const trendLabel = `${i.trend === 'bullish' ? 'Bullish' : i.trend === 'bearish' ? 'Bearish' : 'Sideways'} — ${emaStack}`;
  const macdBull = i.macdSignalType === 'bullish' || i.macdSignalType === 'bullish_crossover';
  const macdBear = i.macdSignalType === 'bearish' || i.macdSignalType === 'bearish_crossover';
  const momentumLabel = macdBull && i.rsi14 >= 50 ? 'Positif' : macdBear || i.rsi14 < 40 ? 'Lemah' : 'Netral';
  const rsiLabel = `${i.rsi14.toFixed(0)} — ${i.rsi14 >= 80 ? 'Overbought ekstrem' : i.rsi14 >= 70 ? 'Overbought' : i.rsi14 >= 50 ? 'Bullish zone' : i.rsi14 <= 30 ? 'Oversold' : 'Netral/lemah'}`;
  const macdLabel =
    i.macdSignalType === 'bullish_crossover' ? 'Golden cross (baru)' :
      i.macdSignalType === 'bearish_crossover' ? 'Death cross (baru)' :
        i.macdSignalType === 'bullish' ? `Di atas signal (hist ${i.macdHistogram.toFixed(1)})` :
          i.macdSignalType === 'bearish' ? `Di bawah signal (hist ${i.macdHistogram.toFixed(1)})` : 'Netral';
  const ema200Label = i.ema200 > 0
    ? `${aboveEma200 ? 'Di atas' : 'Di bawah'} EMA200 ${rp(Math.round(i.ema200))} (${pct(((close - i.ema200) / i.ema200) * 100)})`
    : 'EMA200 belum tersedia';

  // ── Risks.
  const distFromEma9 = ema9 != null && ema9 > 0 ? ((close - ema9) / ema9) * 100 : null;
  const chaseHigh = changePct >= 10 || i.rsi14 >= 80 || (distFromEma9 != null && distFromEma9 >= 10);
  const chaseMed = changePct >= 5 || i.rsi14 >= 70 || (distFromEma9 != null && distFromEma9 >= 5);
  const chaseRisk: RiskLevel3 = chaseHigh ? 'HIGH' : chaseMed ? 'MEDIUM' : 'LOW';
  const chaseRiskNote = chaseRisk === 'LOW'
    ? 'Harga belum jauh dari rata-rata jangka pendek.'
    : `Harga ${pct(changePct)} hari ini${distFromEma9 != null ? `, ${pct(distFromEma9)} di atas EMA9` : ''}, RSI ${i.rsi14.toFixed(0)} — ${chaseRisk === 'HIGH' ? 'beli sekarang = mengejar harga.' : 'rawan koreksi jangka pendek.'}`;

  const eventRisk: RiskLevel3 =
    moveType === 'REOPENING' || suspensionNews || changePct >= 20 ? 'HIGH' :
      moveType === 'EVENT' || (moveType === 'UNKNOWN' && bigMove) || olderEventNews ? 'MEDIUM' : 'LOW';
  const eventRiskNote =
    moveType === 'REOPENING' ? 'Harga pasca-suspensi sangat volatil; ARB/ARA beruntun dan UMA mungkin terjadi.' :
      suspensionNews ? 'Ada sinyal regulator (UMA/suspensi) — risiko saham kembali digembok.' :
        changePct >= 20 ? 'Kenaikan mendekati batas ARA — rawan UMA/suspensi dan profit taking tajam.' :
          moveType === 'EVENT' ? 'Harga dipengaruhi event; reaksi bisa berbalik setelah detail event keluar.' :
            eventRisk === 'MEDIUM' ? 'Pemicu belum jelas — pergerakan bisa cepat berbalik.' : 'Tidak ada event besar terdeteksi.';

  const primaryTrendRisk: RiskLevel3 = !aboveEma200 && i.trend === 'bearish' ? 'HIGH' : !aboveEma200 || i.trend === 'bearish' ? 'MEDIUM' : 'LOW';
  const primaryTrendRiskNote =
    primaryTrendRisk === 'HIGH' ? 'Di bawah EMA200 dan tren turun — kenaikan hari ini masih melawan tren utama.' :
      !aboveEma200 ? 'Di bawah EMA200 — tren jangka panjang belum pulih.' :
        i.trend === 'bearish' ? 'Tren jangka pendek masih turun.' : 'Tren utama mendukung.';

  const otherRisks: string[] = [];
  if (i.rsi14 >= 70) otherRisks.push(`Overbought (RSI ${i.rsi14.toFixed(0)})`);
  if (i.fundamentalRisk === 'HIGH' || i.fundamentalRisk === 'MODERATE_HIGH') otherRisks.push(`Fundamental risk ${i.fundamentalRisk === 'HIGH' ? 'tinggi' : 'cukup tinggi'}`);
  const upperWickDistribution = volAbove && closePosition != null && closePosition < 0.35 && changePct > 0;
  if (i.isStrongDistribution) otherRisks.push('Distribusi kuat (Bandar Detector)');
  else if (i.isDistributionRisk) otherRisks.push('Risiko distribusi (Bandar Detector)');
  if (i.hiddenDistribution) otherRisks.push('Harga naik tapi OBV melemah (distribusi tersembunyi)');
  if (upperWickDistribution) otherRisks.push('Volume tinggi tapi close jauh dari high — indikasi distribusi/profit taking');

  // ── Trade status: start from the 10-second review, only ever move toward caution.
  let tradeStatus: TodayTradeStatus = i.baseStatus === 'BUY_SETUP' ? 'BUY' : i.baseStatus === 'NO_TRADE' ? 'NO_TRADE' : 'WAIT';
  const capReasons: string[] = [];
  if (tradeStatus === 'BUY' && chaseRisk === 'HIGH') { tradeStatus = 'WAIT'; capReasons.push('chase risk tinggi'); }
  if (tradeStatus === 'BUY' && eventRisk === 'HIGH') { tradeStatus = 'WAIT'; capReasons.push('event risk tinggi'); }
  if (tradeStatus === 'BUY' && (moveType === 'UNKNOWN' || moveType === 'REOPENING')) { tradeStatus = 'WAIT'; capReasons.push('pemicu belum jelas'); }
  if (moveType === 'REOPENING' && tradeStatus === 'WAIT' && primaryTrendRisk === 'HIGH') tradeStatus = 'NO_TRADE';

  const buyPermission: TodayMoveAnalysis['buyPermission'] =
    tradeStatus === 'BUY' ? 'YES' :
      tradeStatus === 'WAIT' && i.baseStatus !== 'WATCHLIST' && !explosive && chaseRisk !== 'HIGH' ? 'CONDITIONAL' : 'NO';

  const entryStatus =
    tradeStatus === 'BUY'
      ? 'ENTRY MASIH LAYAK — setup terkonfirmasi, tetap disiplin batas risiko.'
      : explosive || chaseRisk === 'HIGH'
        ? `EXPLOSIVE MOVE TERDETEKSI, ENTRY TIDAK LAYAK DIKEJAR. ${i.baseScenario}`
        : tradeStatus === 'NO_TRADE'
          ? 'Tidak ada setup beli yang layak saat ini.'
          : `Belum ada konfirmasi. ${i.baseScenario}`;

  // ── Kesimpulan 10 detik.
  const sourceTxt: Record<MoveType, string> = {
    NORMAL: 'pergerakan NORMAL (tidak ada ekspansi berarti)',
    PRICE_VOLUME_EXPANSION: 'PRICE-VOLUME EXPANSION',
    BREAKOUT: 'BREAKOUT',
    ACCUMULATION: 'ACCUMULATION',
    EVENT: 'EVENT / corporate action',
    REOPENING: 'REOPENING setelah suspensi',
    UNKNOWN: 'penyebab yang BELUM DIKETAHUI',
  };
  const dir = changePct >= 0 ? 'Kenaikan' : 'Penurunan';
  const moveRead = `${dir} ${summary.ticker} hari ini (${pct(changePct)}) berasal dari ${sourceTxt[moveType]}`;
  const catalystRead =
    catalystStatus === 'VERIFIED' ? 'dengan pemicu terverifikasi' :
      catalystStatus === 'SUSPECTED' ? 'dengan pemicu yang baru berupa indikasi' : 'tanpa pemicu terverifikasi';
  const actionRead =
    tradeStatus === 'BUY'
      ? 'Entry masih layak selama batas risiko dijaga.'
      : explosive
        ? 'Explosive move terdeteksi, tapi itu BUKAN berarti entry masih layak — jangan kejar, tunggu pullback/konsolidasi.'
        : tradeStatus === 'NO_TRADE'
          ? 'Belum ada setup beli — lebih baik menunggu.'
          : `Tunggu konfirmasi dulu${capReasons.length ? ` (${capReasons.join(', ')})` : ''}.`;
  const conclusion = `${moveRead}, ${catalystRead}. ${actionRead}`;

  return {
    prevClose, close, open, high, low, changePct, volume, prevVolume, volumeChangePct, avgVolume20, rvol,
    rangeExpansion, closePosition, gapPct, sessionGapDays,
    moveType, moveTypeReason, explosive,
    catalystStatus, catalystSummary, evidence,
    trendLabel, momentumLabel, rsiLabel, macdLabel, ema200Label, ema9, ema21,
    support: i.support, resistance: i.resistance,
    chaseRisk, chaseRiskNote, eventRisk, eventRiskNote, primaryTrendRisk, primaryTrendRiskNote, otherRisks,
    tradeStatus, buyPermission, entryStatus, conclusion,
  };
}

export const EVIDENCE_KIND_LABEL: Record<EvidenceKind, string> = {
  FAKTA: 'FAKTA',
  INDIKASI: 'INDIKASI',
  BELUM_TERVERIFIKASI: 'BELUM TERVERIFIKASI',
};

export function describeClosePosition(p: number | null): string {
  if (p == null) return '–';
  const pos = Math.round(p * 100);
  return `${pos}% dari range — ${p >= 0.75 ? 'close dekat high (kuat)' : p <= 0.25 ? 'close dekat low (lemah)' : 'close di tengah range'}`;
}

/** Plain-text version in the exact "TODAY MOVE ANALYSIS" format, for copy/share. */
export function formatTodayMoveAnalysis(ticker: string, a: TodayMoveAnalysis): string {
  return [
    `🚨 ${ticker} — TODAY MOVE ANALYSIS`,
    '',
    `Previous Close: ${rp(a.prevClose)}`,
    `Today Close: ${rp(a.close)}`,
    `Change: ${pct(a.changePct, 2)}`,
    '',
    '📊 PRICE & VOLUME',
    `O/H/L/C: ${rp(a.open)} / ${rp(a.high)} / ${rp(a.low)} / ${rp(a.close)}`,
    `Price Change: ${pct(a.changePct, 2)}${a.gapPct != null ? ` (gap open ${pct(a.gapPct)})` : ''}`,
    `Volume Change: ${a.volume.toLocaleString('id-ID')} vs ${a.prevVolume != null ? a.prevVolume.toLocaleString('id-ID') : '–'} (${pct(a.volumeChangePct, 0)})`,
    `RVOL: ${x(a.rvol)}${a.avgVolume20 != null ? ` (avg 20D ${Math.round(a.avgVolume20).toLocaleString('id-ID')})` : ''}`,
    `Range Expansion: ${x(a.rangeExpansion)}`,
    `Close Position: ${describeClosePosition(a.closePosition)}`,
    '',
    '🚨 MOVE TYPE',
    MOVE_TYPE_LABEL[a.moveType],
    a.moveTypeReason,
    '',
    '🔎 CATALYST',
    CATALYST_STATUS_LABEL[a.catalystStatus],
    a.catalystSummary,
    ...a.evidence.map((e) => `- [${EVIDENCE_KIND_LABEL[e.kind]}] ${e.text}`),
    '',
    '📈 TECHNICAL',
    `Trend: ${a.trendLabel}`,
    `Momentum: ${a.momentumLabel}`,
    `RSI: ${a.rsiLabel}`,
    `MACD: ${a.macdLabel}`,
    `EMA200: ${a.ema200Label}`,
    `Support: ${rp(a.support)}`,
    `Resistance: ${rp(a.resistance)}`,
    '',
    '⚠️ RISK',
    `Chase Risk: ${a.chaseRisk} — ${a.chaseRiskNote}`,
    `Event Risk: ${a.eventRisk} — ${a.eventRiskNote}`,
    `Primary Trend Risk: ${a.primaryTrendRisk} — ${a.primaryTrendRiskNote}`,
    ...a.otherRisks.map((r) => `- ${r}`),
    '',
    '🎯 TRADE STATUS',
    TODAY_TRADE_STATUS_LABEL[a.tradeStatus],
    `Buy Permission: ${a.buyPermission}`,
    `Entry Status: ${a.entryStatus}`,
    '',
    '🧠 KESIMPULAN 10 DETIK',
    a.conclusion,
  ].join('\n');
}
