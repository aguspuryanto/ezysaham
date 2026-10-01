/**
 * fundamentalAcceleration.ts
 *
 * FUNDAMENTAL CHANGE vs PRICE LAG (features_fundamental_acceleration.md): does the business improve
 * faster than the share price has moved? Combines YoY growth / ROE / margin / debt (fundamental change),
 * 3M/6M/1Y return + distance from the 52W high (price lag), PER/PBV verdict (valuation) and the technical
 * stage into one status: RERATING CANDIDATE / EARLY WATCH / WAIT CONFIRMATION / NO TRADE.
 *
 * Pure function, no fetching — the same output can feed the detail report and a screener table
 * (Ticker | Sector | Fundamental Score | Price Lag | Valuation | Catalyst | Technical Stage | Risk | Status).
 * Data the feed does not carry (EPS, ROE/margin history, NPL, catalyst) is reported as missing, never guessed.
 * Never a price forecast: `requirements` lists what must happen for a rerating to play out.
 */

export type AccelSignal = 'green' | 'yellow' | 'red' | 'na';
export type FundamentalChange = 'POSITIF' | 'NETRAL' | 'NEGATIF' | 'DATA_KURANG';
export type PriceLag = 'TINGGI' | 'SEDANG' | 'RENDAH' | 'TIDAK_RELEVAN' | 'DATA_KURANG';
export type TechnicalStage = 'UPTREND' | 'REVERSAL' | 'SIDEWAYS' | 'DOWNTREND' | 'DATA_KURANG';
export type ReratingStatus = 'RERATING_CANDIDATE' | 'EARLY_WATCH' | 'WAIT_CONFIRMATION' | 'NO_TRADE';
export type ValuationSignal = 'cheap' | 'fair' | 'expensive' | 'na';

export const RERATING_STATUS_LABEL: Record<ReratingStatus, string> = {
  RERATING_CANDIDATE: '🚀 RERATING CANDIDATE',
  EARLY_WATCH: '👀 EARLY WATCH',
  WAIT_CONFIRMATION: '⏳ WAIT CONFIRMATION',
  NO_TRADE: '❌ NO TRADE',
};
export const FUNDAMENTAL_CHANGE_LABEL: Record<FundamentalChange, string> = {
  POSITIF: 'POSITIF', NETRAL: 'NETRAL', NEGATIF: 'NEGATIF', DATA_KURANG: 'DATA TIDAK TERSEDIA',
};
export const PRICE_LAG_LABEL: Record<PriceLag, string> = {
  TINGGI: 'TINGGI', SEDANG: 'SEDANG', RENDAH: 'RENDAH (harga sudah ikut naik)', TIDAK_RELEVAN: 'TIDAK RELEVAN', DATA_KURANG: 'DATA TIDAK TERSEDIA',
};
export const TECHNICAL_STAGE_LABEL: Record<TechnicalStage, string> = {
  UPTREND: 'Uptrend', REVERSAL: 'Reversal / akumulasi', SIDEWAYS: 'Sideways / basing', DOWNTREND: 'Downtrend', DATA_KURANG: 'DATA TIDAK TERSEDIA',
};

export interface FundamentalAccelerationInput {
  price: number;
  annualHigh: number;
  /** % returns; null/NaN = unavailable. */
  return3M: number | null;
  return6M: number | null;
  return1Y: number | null;
  /** % YoY. */
  revenueGrowth: number | null;
  earningsGrowth: number | null;
  /** % */
  roe: number | null;
  netMargin: number | null;
  /** % (100 = 1×). */
  debtToEquity: number | null;
  isFinancial: boolean;
  per: number | null;
  pbv: number | null;
  valuation: ValuationSignal;
  fairValue: number | null;
  /** Daily traded value in rupiah. */
  tradedValue: number | null;
  ema20: number;
  ema50: number;
  trend: 'bullish' | 'bearish' | 'sideways';
  rsi14: number | null;
  macdSignalType: 'bullish_crossover' | 'bullish' | 'bearish_crossover' | 'bearish' | 'neutral';
}

export interface AccelLine {
  label: string;
  value: string;
  signal: AccelSignal;
}

export interface FundamentalAccelerationResult {
  /** 0–100, null when too little fundamental data. */
  fundamentalScore: number | null;
  change: FundamentalChange;
  lag: PriceLag;
  stage: TechnicalStage;
  status: ReratingStatus;
  /** Rerating potential headline, e.g. "🟡 MENUNGGU KONFIRMASI". */
  reratingPotential: { signal: AccelSignal; label: string };
  /** Distance from the 52W high in % (negative = below the high). */
  fromHighPct: number | null;
  /** "Fundamental ↑ sementara Harga ↓" style one-liner. */
  earningsVsPrice: string;
  lines: AccelLine[];
  /** 🔴 avoid-flags that were hit. */
  risks: string[];
  /** What has to happen for the rerating thesis to play out. */
  requirements: string[];
  missing: string[];
  reason: string;
}

const NO_DATA = 'DATA TIDAK TERSEDIA';
/** Same coarse liquidity floor the screener presets use (Rp 1 miliar / hari). */
const MIN_TRADED_VALUE = 1_000_000_000;

const num = (n: number | null | undefined): n is number => n != null && Number.isFinite(n);
const fmt = (n: number, dec = 1) => n.toLocaleString('id-ID', { minimumFractionDigits: dec, maximumFractionDigits: dec });
const pct = (n: number | null | undefined, dec = 1) => (num(n) ? `${n > 0 ? '+' : ''}${fmt(n, dec)}%` : NO_DATA);
const rp = (n: number) => `Rp ${Math.round(n).toLocaleString('id-ID')}`;

/** Scores each available metric against its own max, then normalises — missing data never counts as 0. */
function scoreFundamentals(i: FundamentalAccelerationInput): { score: number | null; coverage: number } {
  const parts: Array<[number, number]> = []; // [points, max]
  if (num(i.revenueGrowth)) parts.push([i.revenueGrowth >= 10 ? 20 : i.revenueGrowth > 0 ? 10 : 0, 20]);
  if (num(i.earningsGrowth)) parts.push([i.earningsGrowth >= 20 ? 30 : i.earningsGrowth >= 10 ? 20 : i.earningsGrowth > 0 ? 10 : 0, 30]);
  if (num(i.roe) && i.roe !== 0) parts.push([i.roe >= 15 ? 20 : i.roe >= 10 ? 12 : i.roe > 0 ? 5 : 0, 20]);
  if (num(i.netMargin)) parts.push([i.netMargin >= 10 ? 15 : i.netMargin > 0 ? 8 : 0, 15]);
  if (num(i.debtToEquity) && !i.isFinancial) parts.push([i.debtToEquity <= 100 ? 15 : i.debtToEquity <= 200 ? 7 : 0, 15]);
  const max = parts.reduce((s, [, m]) => s + m, 0);
  const coverage = max / (i.isFinancial ? 85 : 100);
  if (max < 50) return { score: null, coverage };
  return { score: Math.round((parts.reduce((s, [p]) => s + p, 0) / max) * 100), coverage };
}

export function buildFundamentalAcceleration(i: FundamentalAccelerationInput): FundamentalAccelerationResult {
  const rg = num(i.revenueGrowth) ? i.revenueGrowth : null;
  const eg = num(i.earningsGrowth) ? i.earningsGrowth : null;
  const roe = num(i.roe) && i.roe !== 0 ? i.roe : null;
  const per = num(i.per) && i.per !== 0 ? i.per : null;
  const pbv = num(i.pbv) && i.pbv > 0 ? i.pbv : null;
  const r3 = num(i.return3M) ? i.return3M : null;
  const r6 = num(i.return6M) ? i.return6M : null;
  const r1y = num(i.return1Y) ? i.return1Y : null;
  const fromHighPct = num(i.price) && i.price > 0 && num(i.annualHigh) && i.annualHigh > 0 ? ((i.price - i.annualHigh) / i.annualHigh) * 100 : null;

  const { score } = scoreFundamentals(i);

  // ── Fundamental change ──
  const change: FundamentalChange = score == null || eg == null ? 'DATA_KURANG'
    : (eg <= -20 || (eg < 0 && (rg == null || rg < 0)) || (per != null && per < 0)) ? 'NEGATIF'
      : eg > 0 && (rg == null || rg >= 0) && score >= 60 ? 'POSITIF'
        : 'NETRAL';
  /** Profit jumping far ahead of revenue is often one-off (asset sale, FX, tax) — flag, don't reward. */
  const oneOffSuspect = eg != null && rg != null && eg >= 50 && rg <= 5;

  // ── Price lag ── (worst of the available return windows vs the 52W high)
  const returns = [r3, r6, r1y].filter((x): x is number => x != null);
  const worstReturn = returns.length ? Math.min(...returns) : null;
  const priceWeak = (worstReturn != null && worstReturn < 0) || (fromHighPct != null && fromHighPct <= -30);
  const priceFlat = (r1y != null && r1y <= 20) || (fromHighPct != null && fromHighPct <= -15);
  const extended = (r3 != null && r3 >= 40) || (fromHighPct != null && fromHighPct >= -5 && i.rsi14 != null && i.rsi14 >= 70);
  const lag: PriceLag = returns.length === 0 && fromHighPct == null ? 'DATA_KURANG'
    : change !== 'POSITIF' ? 'TIDAK_RELEVAN'
      : extended ? 'RENDAH'
        : priceWeak ? 'TINGGI'
          : priceFlat ? 'SEDANG'
            : 'RENDAH';

  // ── Technical stage ──
  const emaOk = num(i.ema20) && i.ema20 > 0 && num(i.ema50) && i.ema50 > 0;
  const stage: TechnicalStage = !emaOk ? 'DATA_KURANG'
    : i.trend === 'bullish' && i.price > i.ema20 ? 'UPTREND'
      : (i.price > i.ema20 && i.trend !== 'bullish') || i.macdSignalType === 'bullish_crossover' ? 'REVERSAL'
        : i.trend === 'bearish' ? 'DOWNTREND'
          : 'SIDEWAYS';

  const illiquid = num(i.tradedValue) && i.tradedValue < MIN_TRADED_VALUE;
  const valuationOk = i.valuation === 'cheap' || i.valuation === 'fair';

  const risks = [
    change === 'NEGATIF' && '🔴 Fundamental memburuk',
    extended && '🔴 Harga sudah terlalu extended',
    oneOffSuspect && `🔴 Laba ${pct(eg)} jauh di atas pendapatan ${pct(rg)} — kemungkinan faktor one-off`,
    illiquid && `🔴 Likuiditas rendah (nilai transaksi < Rp 1 M/hari)`,
    change !== 'POSITIF' && i.valuation === 'cheap' && priceWeak && '🔴 Murah tapi fundamental belum membaik — risiko value trap',
    i.valuation === 'expensive' && '🔴 Valuasi sudah mahal — ruang rerating terbatas',
  ].filter((x): x is string => Boolean(x));

  // ── Status ──
  const lagOk = lag === 'TINGGI' || lag === 'SEDANG';
  const status: ReratingStatus = change === 'NEGATIF' || extended || illiquid || (per != null && per < 0) ? 'NO_TRADE'
    : change === 'POSITIF' && lagOk && valuationOk && !oneOffSuspect && (stage === 'REVERSAL' || stage === 'UPTREND') ? 'RERATING_CANDIDATE'
      : change === 'POSITIF' && lagOk && valuationOk && !oneOffSuspect ? 'EARLY_WATCH'
        : 'WAIT_CONFIRMATION';

  const reratingPotential: FundamentalAccelerationResult['reratingPotential'] = status === 'RERATING_CANDIDATE' ? { signal: 'green', label: 'TINGGI — setup terbentuk' }
    : status === 'EARLY_WATCH' ? { signal: 'yellow', label: 'MENUNGGU KONFIRMASI' }
      : status === 'WAIT_CONFIRMATION' ? { signal: 'yellow', label: 'TERBATAS' }
        : { signal: 'red', label: 'RENDAH' };

  const fundArrow = change === 'POSITIF' ? '↑' : change === 'NEGATIF' ? '↓' : change === 'NETRAL' ? '→' : '?';
  const priceArrow = worstReturn == null && fromHighPct == null ? '?' : priceWeak ? '↓' : priceFlat ? '→' : '↑';
  const earningsVsPrice = `Fundamental ${fundArrow} sementara Harga ${priceArrow}${fundArrow === '↑' && priceArrow === '↓' ? ' — harga tertinggal' : fundArrow === '↑' && priceArrow === '↑' ? ' — harga sudah mengikuti' : ''}`;

  const sig = (good: boolean | null, bad: boolean | null): AccelSignal => (good == null ? 'na' : good ? 'green' : bad ? 'red' : 'yellow');
  const lines: AccelLine[] = [
    { label: 'Revenue Growth', value: rg != null ? `${pct(rg)} YoY` : NO_DATA, signal: rg == null ? 'na' : sig(rg >= 10, rg < 0) },
    { label: 'Profit Growth', value: eg != null ? `${pct(eg)} YoY` : NO_DATA, signal: eg == null ? 'na' : sig(eg >= 10 && !oneOffSuspect, eg < 0) },
    { label: 'EPS Growth', value: eg != null ? `${NO_DATA} (proxy laba ${pct(eg)})` : NO_DATA, signal: 'na' },
    { label: 'ROE', value: roe != null ? `${fmt(roe)}% (trend ${NO_DATA})` : NO_DATA, signal: roe == null ? 'na' : sig(roe >= 12, roe < 5) },
    { label: 'Net Margin', value: num(i.netMargin) ? `${fmt(i.netMargin)}% (trend ${NO_DATA})` : NO_DATA, signal: !num(i.netMargin) ? 'na' : sig(i.netMargin >= 10, i.netMargin <= 0) },
    i.isFinancial
      ? { label: 'Asset quality (NPL)', value: `${NO_DATA} (bank/keuangan)`, signal: 'na' }
      : { label: 'DER', value: num(i.debtToEquity) ? `${fmt(i.debtToEquity / 100, 2)}×` : NO_DATA, signal: !num(i.debtToEquity) ? 'na' : sig(i.debtToEquity <= 100, i.debtToEquity > 200) },
    {
      label: 'Return 3M / 6M / 1Y',
      value: `${pct(r3)} / ${pct(r6)} / ${pct(r1y)}`,
      signal: worstReturn == null ? 'na' : extended ? 'red' : priceWeak ? 'green' : priceFlat ? 'yellow' : 'red',
    },
    {
      label: 'Harga vs 52W High',
      value: fromHighPct != null ? pct(fromHighPct) : NO_DATA,
      signal: fromHighPct == null ? 'na' : fromHighPct <= -30 ? 'green' : fromHighPct <= -15 ? 'yellow' : 'red',
    },
    {
      label: 'Valuation',
      value: `PER ${per != null ? `${fmt(per)}×` : NO_DATA} / PBV ${pbv != null ? `${fmt(pbv, 2)}×` : NO_DATA}`,
      signal: i.valuation === 'cheap' ? 'green' : i.valuation === 'fair' ? 'yellow' : i.valuation === 'expensive' ? 'red' : 'na',
    },
    { label: 'Catalyst', value: `${NO_DATA} — cek berita, aksi korporasi & laporan kuartal berikutnya`, signal: 'na' },
  ];
  // Price-lag lines are only "good" when the fundamentals justify a catch-up; otherwise a falling price is just a falling price.
  if (change !== 'POSITIF') {
    for (const l of lines) if (l.label === 'Return 3M / 6M / 1Y' || l.label === 'Harga vs 52W High') l.signal = priceWeak ? 'red' : l.signal;
  }

  const requirements = [
    change !== 'POSITIF' && 'Laporan kuartal berikutnya menunjukkan laba & pendapatan tumbuh YoY.',
    change === 'POSITIF' && 'Laporan kuartal berikutnya mengonfirmasi growth berlanjut (bukan one-off).',
    ((rg != null && rg >= 100) || (eg != null && eg >= 100)) && 'Growth > 100% YoY dibuktikan sustainable (bukan efek basis rendah) di 1–2 kuartal berikutnya.',
    stage !== 'UPTREND' && emaOk && `Harga close kembali di atas EMA20 ${rp(i.ema20)} lalu EMA50 ${rp(i.ema50)}.`,
    'Volume akumulasi meningkat (RVOL ≥ 1,5× saat breakout).',
    num(i.fairValue) && i.fairValue > i.price && `Pasar mulai menghargai ulang valuasi menuju nilai wajar ${rp(i.fairValue)}.`,
    'Ada catalyst bisnis (kontrak baru, ekspansi, dividen, aksi korporasi) yang dikenali pasar.',
  ].filter((x): x is string => Boolean(x));

  const missing = [
    rg == null && 'Revenue growth', eg == null && 'Profit growth', 'EPS growth', 'Trend ROE/margin historis',
    i.isFinancial && 'NPL', 'Catalyst', 'PER/PBV historis/sektor',
  ].filter((x): x is string => Boolean(x));

  const reason = status === 'RERATING_CANDIDATE' ? 'Fundamental membaik, harga tertinggal, valuasi wajar dan teknikal mulai berbalik.'
    : status === 'EARLY_WATCH' ? 'Fundamental membaik & harga tertinggal, tetapi teknikal belum reversal — pantau.'
      : status === 'NO_TRADE' ? `Tidak layak: ${risks.length ? risks.map((r) => r.replace('🔴 ', '')).join('; ') : 'data tidak mendukung'}.`
        : change === 'DATA_KURANG' ? 'Data fundamental tidak cukup untuk menilai akselerasi.'
          : change === 'NETRAL' ? 'Fundamental belum menunjukkan akselerasi yang jelas.'
            : !valuationOk ? 'Fundamental membaik, tetapi valuasi tidak lagi murah/wajar.'
              : oneOffSuspect ? 'Lonjakan laba perlu dicek apakah one-off sebelum dianggap akselerasi.'
                : 'Harga sudah mengikuti fundamental — price lag kecil.';

  return { fundamentalScore: score, change, lag, stage, status, reratingPotential, fromHighPct, earningsVsPrice, lines, risks, requirements, missing, reason };
}
