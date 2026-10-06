/**
 * dayTradingReport.ts
 *
 * "⚡ EzySaham AI — DAY TRADING" — the short per-ticker report shown from the Day Trading table.
 * Order: Trend → Momentum → Volume → Likuiditas → Trigger · Entry · SL · TP · R:R → Kesimpulan.
 *
 * EOD data only: break high is a TRIGGER to confirm with the realtime price, never an assumed
 * breakout. DAY TRADE SETUP ≠ automatic entry. No "beli sekarang" anywhere.
 */

import {
  DAY_TRADING_VERDICT_LABEL,
  DayTradingSetup,
  DayTradingVerdict,
  DT_MIN_AVG_VALUE_20D,
  DT_MIN_RR,
  DT_MIN_RVOL,
} from './dayTrading';
import { DATA_NA } from './setupUtils';

export const DAY_TRADING_VERDICT_EMOJI: Record<DayTradingVerdict, string> = { SETUP: '🟢', WATCH: '🟡', AVOID: '🔴', AVOID_CHASING: '🔴' };

export interface DayTradingReport {
  ticker: string;
  verdict: DayTradingVerdict;
  status: string;
  trend: string;
  momentum: string;
  volume: string;
  liquidity: string;
  trigger: string;
  entry: string;
  sl: string;
  tp: string;
  rr: string;
  conclusion: string;
}

const rp = (n: number | null) => (n == null ? DATA_NA : `Rp${Math.round(n).toLocaleString('id-ID')}`);
const n1 = (n: number, d = 1) => n.toLocaleString('id-ID', { minimumFractionDigits: d, maximumFractionDigits: d });
const value = (n: number) => (n >= 1e12 ? `Rp${n1(n / 1e12)} T` : n >= 1e9 ? `Rp${n1(n / 1e9)} M` : `Rp${n1(n / 1e6, 0)} jt`);
const shares = (n: number) => (n >= 1e9 ? `${n1(n / 1e9)} M lbr` : n >= 1e6 ? `${n1(n / 1e6)} jt lbr` : `${Math.round(n).toLocaleString('id-ID')} lbr`);

export function buildDayTradingReport(ticker: string, dt: DayTradingSetup): DayTradingReport {
  const v = dt.verdict;

  const trendWhy = dt.trend === 'BULLISH' ? 'harga di atas EMA9/21/50 yang tersusun naik'
    : dt.trend === 'BEARISH' ? 'harga di bawah EMA9/21/50 yang tersusun turun'
      : 'EMA9/21/50 belum searah';
  const momentumWhy = [
    dt.rsi != null ? `RSI ${n1(dt.rsi, 0)}` : null,
    dt.macdHistogram != null ? `MACD ${dt.macdHistogram > 0 ? 'positif' : 'negatif'}` : null,
  ].filter(Boolean).join(' · ');

  const up = dt.return1D > 0;
  const volRead = dt.rvol == null ? 'Data volume belum tersedia'
    : up && dt.rvol >= DT_MIN_RVOL ? 'Kenaikan didukung volume'
      : up ? 'Naik, tetapi volume belum mendukung'
        : dt.rvol >= DT_MIN_RVOL ? 'Volume ramai, tetapi harga tidak naik'
          : 'Volume sepi';

  const liqRead = dt.avgValue20D == null ? 'Data transaksi belum tersedia'
    : dt.avgValue20D >= 20e9 ? 'Ramai, mudah keluar-masuk'
      : dt.avgValue20D >= DT_MIN_AVG_VALUE_20D ? 'Cukup ramai'
        : 'Terlalu sepi — sulit keluar cepat';
  const liqNumbers = [
    dt.todayValue != null ? `hari ini ${value(dt.todayValue)}` : null,
    dt.avgValue20D != null ? `rata-rata 20H ${value(dt.avgValue20D)}` : null,
  ].filter(Boolean).join(' · ');

  const rrBad = dt.riskReward == null || dt.riskReward < DT_MIN_RR;
  const conclusion = v === 'SETUP'
    ? `Layak dipantau — tunggu harga menembus ${rp(dt.entryTrigger)} dulu, jangan masuk sebelum itu.`
    : v === 'AVOID_CHASING'
      ? 'Harganya sudah lari terlalu jauh — jangan dikejar, tunggu turun dulu.'
      : v === 'AVOID'
        ? (dt.avgValue20D != null && dt.avgValue20D < DT_MIN_AVG_VALUE_20D ? 'Terlalu sepi untuk day trading — lewati dulu.'
          : dt.trend === 'BEARISH' ? 'Arahnya turun — lewati dulu.' : 'Risikonya terlalu besar untuk day trading — lewati dulu.')
        : rrBad ? 'Menarik, tetapi untungnya belum sebanding dengan risikonya — pantau saja.'
          : 'Menarik, tetapi belum cukup kuat — pantau dulu, belum ada sinyal masuk.';

  return {
    ticker,
    verdict: v,
    status: `${DAY_TRADING_VERDICT_EMOJI[v]} ${DAY_TRADING_VERDICT_LABEL[v]}`,
    trend: `${dt.trend} — ${trendWhy}`,
    momentum: `${dt.momentum}${momentumWhy ? ` — ${momentumWhy}` : ''}`,
    volume: `${volRead}${dt.volume != null ? ` (${shares(dt.volume)})` : ''} · RVOL ${dt.rvol == null ? DATA_NA : `${n1(dt.rvol, 2)}x`}`,
    liquidity: `${liqRead}${liqNumbers ? ` (${liqNumbers})` : ''}`,
    trigger: dt.entryTrigger == null ? DATA_NA : `Break High > ${rp(dt.entryTrigger)}`,
    entry: dt.entryTrigger == null ? DATA_NA : v === 'AVOID' || v === 'AVOID_CHASING' ? 'Tidak ada — jangan entry' : `${rp(dt.entryTrigger)} setelah trigger`,
    sl: rp(dt.sl),
    tp: rp(dt.tp),
    rr: dt.riskReward == null ? DATA_NA : `1 : ${n1(dt.riskReward, 2)}${rrBad ? ` (di bawah 1 : ${n1(DT_MIN_RR)} — tidak layak entry)` : ''}`,
    conclusion,
  };
}

/** Plain text in the fixed format — used by the copy button. */
export function dayTradingReportText(r: DayTradingReport): string {
  return [
    '⚡ EzySaham AI — DAY TRADING',
    '',
    r.ticker,
    '',
    `Status: ${r.status}`,
    '',
    `Trend: ${r.trend}`,
    `Momentum: ${r.momentum}`,
    `Volume: ${r.volume}`,
    `Likuiditas: ${r.liquidity}`,
    `Trigger: ${r.trigger}`,
    `Entry: ${r.entry}`,
    `SL: ${r.sl}`,
    `TP: ${r.tp}`,
    `R:R: ${r.rr}`,
    '',
    '💡 Kesimpulan:',
    r.conclusion,
    '',
    '⚠️ Data EOD, bukan realtime.',
    'Trigger wajib dikonfirmasi dengan harga realtime.',
  ].join('\n');
}
