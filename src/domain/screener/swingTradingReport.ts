/**
 * swingTradingReport.ts
 *
 * "⚡ EzySaham AI — SWING" — the short per-ticker report shown from the Swing Trading table.
 * Order: Setup → Trend → Momentum → Volume → Support / Resistance → 🎯 Trigger → Entry · SL · TP ·
 * Target · R:R → Kesimpulan. Target +5–15% in 3–10 trading days.
 *
 * EOD data only: setup ≠ BUY — entry only after the trigger is valid. No "beli sekarang" anywhere.
 */

import { DATA_NA } from './setupUtils';
import {
  SW_BREAKOUT_RVOL,
  SW_MIN_RR,
  SW_MIN_RVOL,
  SW_TARGET_MAX_PCT,
  SW_TARGET_MIN_PCT,
  SWING_VERDICT_LABEL,
  SwingSetupType,
  SwingTradingSetup,
  SwingVerdict,
} from './swingTrading';

export const SWING_VERDICT_EMOJI: Record<SwingVerdict, string> = { SETUP: '🟢', WATCH: '🟡', AVOID: '🔴', AVOID_CHASING: '🔴' };
const SETUP_TEXT: Record<SwingSetupType, string> = {
  BREAKOUT: 'BREAKOUT',
  BREAKOUT_RETEST: 'BREAKOUT-RETEST',
  PULLBACK: 'HEALTHY PULLBACK',
  NONE: 'NO SETUP',
};

export interface SwingTradingReport {
  ticker: string;
  verdict: SwingVerdict;
  status: string;
  setup: string;
  trend: string;
  momentum: string;
  volume: string;
  support: string;
  resistance: string;
  trigger: string;
  entry: string;
  sl: string;
  tp: string;
  target: string;
  rr: string;
  conclusion: string;
}

const rp = (n: number | null) => (n == null ? DATA_NA : `Rp${Math.round(n).toLocaleString('id-ID')}`);
const n1 = (n: number, d = 1) => n.toLocaleString('id-ID', { minimumFractionDigits: d, maximumFractionDigits: d });
const shares = (n: number) => (n >= 1e9 ? `${n1(n / 1e9)} M lbr` : n >= 1e6 ? `${n1(n / 1e6)} jt lbr` : `${Math.round(n).toLocaleString('id-ID')} lbr`);

export function buildSwingTradingReport(ticker: string, sw: SwingTradingSetup): SwingTradingReport {
  const v = sw.verdict;
  const st = sw.setupType;
  const noEntry = v === 'AVOID' || v === 'AVOID_CHASING' || st === 'NONE';

  const trendWhy = sw.trendCall === 'BULLISH' ? 'di atas EMA9/21/50/200, struktur naik'
    : sw.trendCall === 'RECOVERY' ? 'mulai naik, tetapi belum di atas semua EMA utama'
      : sw.trendCall === 'BEARISH' ? 'di bawah EMA utama, struktur turun'
        : 'EMA dan struktur harga belum searah';
  const momentumWhy = [
    sw.rsi != null ? `RSI ${n1(sw.rsi, 0)}` : null,
    sw.macdHistogram != null ? `MACD ${sw.macdHistogram > 0 ? 'positif' : 'negatif'}` : null,
  ].filter(Boolean).join(' · ');

  const volRead = sw.rvol == null ? 'Data volume belum tersedia'
    : st === 'BREAKOUT' || st === 'BREAKOUT_RETEST'
      ? (sw.rvol >= SW_BREAKOUT_RVOL ? 'Breakout didukung volume' : 'Volume belum mendukung breakout')
      : st === 'PULLBACK'
        ? (sw.pullbackVolumeOk ? 'Sehat — volume mengecil saat turun, naik saat memantul' : 'Volume pullback belum ideal')
        : sw.rvol >= SW_MIN_RVOL ? 'Volume ramai' : 'Volume biasa / sepi';

  const trigger = st === 'BREAKOUT'
    ? `Harga menembus dan bertahan di atas ${rp(sw.entryTrigger)}${sw.rvol != null && sw.rvol < SW_BREAKOUT_RVOL ? ' dengan volume ramai' : ''}.`
    : st === 'BREAKOUT_RETEST'
      ? `Harga bertahan di atas level breakout ${rp(sw.breakoutLevel)} lalu menembus ${rp(sw.entryTrigger)}.`
      : st === 'PULLBACK'
        ? `Pantulan dari ${rp(sw.support)} / EMA terkonfirmasi: harga menembus ${rp(sw.entryTrigger)}.`
        : 'Belum ada — tunggu setup breakout, retest, atau pullback sehat terbentuk.';

  const targetPct = sw.tp1Pct;
  const targetBad = targetPct == null || targetPct < SW_TARGET_MIN_PCT || targetPct > SW_TARGET_MAX_PCT;
  const rrBad = sw.riskReward == null || sw.riskReward < SW_MIN_RR;

  const conclusion = v === 'SETUP'
    ? `Setup ${SETUP_TEXT[st].toLowerCase()} siap — masuk hanya setelah trigger ${rp(sw.entryTrigger)} tembus.`
    : v === 'AVOID_CHASING'
      ? 'Harganya sudah lari terlalu jauh — jangan dikejar, tunggu turun dulu.'
      : v === 'AVOID'
        ? (sw.trendCall === 'BEARISH' ? 'Arahnya turun — lewati dulu.' : 'Belum layak swing (likuiditas atau risikonya tidak mendukung) — lewati dulu.')
        : st === 'NONE' ? 'Belum ada setup yang jelas — jangan dipaksakan, pantau saja.'
          : sw.trendCall !== 'BULLISH' || sw.momentumCall === 'LEMAH' ? 'Setupnya ada, tetapi arah dan tenaganya belum kompak — pantau dulu.'
            : rrBad || targetBad ? 'Setupnya ada, tetapi untung-ruginya belum menarik — pantau dulu.'
              : 'Setupnya menarik, tetapi trigger belum terjadi — tunggu konfirmasi.';

  return {
    ticker,
    verdict: v,
    status: `${SWING_VERDICT_EMOJI[v]} ${SWING_VERDICT_LABEL[v]}`,
    setup: SETUP_TEXT[st],
    trend: `${sw.trendCall} — ${trendWhy} (${sw.structure.label})`,
    momentum: `${sw.momentumCall}${momentumWhy ? ` — ${momentumWhy}` : ''}`,
    volume: `${volRead}${sw.volume != null ? ` (${shares(sw.volume)})` : ''} · RVOL ${sw.rvol == null ? DATA_NA : `${n1(sw.rvol, 2)}x`}`,
    support: rp(sw.support),
    resistance: sw.resistance == null ? 'Tidak ada di atas (dekat harga tertinggi)' : rp(sw.resistance),
    trigger,
    entry: noEntry ? 'Tidak ada — jangan entry' : `${rp(sw.entryTrigger)} setelah trigger${sw.maxEntry != null ? ` (maks ${rp(sw.maxEntry)})` : ''}`,
    sl: rp(sw.sl),
    tp: sw.tp2 != null ? `${rp(sw.tp1)} · ${rp(sw.tp2)}` : rp(sw.tp1),
    target: targetPct == null ? DATA_NA : `+${n1(targetPct)}%${targetBad ? ` (di luar ${SW_TARGET_MIN_PCT}–${SW_TARGET_MAX_PCT}%)` : ''}`,
    rr: sw.riskReward == null ? DATA_NA : `1:${n1(sw.riskReward)}${rrBad ? ` (di bawah 1:${SW_MIN_RR} — tidak layak entry)` : ''}`,
    conclusion,
  };
}

/** Plain text in the fixed format — used by the copy button. */
export function swingTradingReportText(r: SwingTradingReport): string {
  return [
    '⚡ EzySaham AI — SWING',
    '',
    r.ticker,
    '',
    `Status: ${r.status}`,
    '',
    `Setup: ${r.setup}`,
    '',
    `Trend: ${r.trend}`,
    `Momentum: ${r.momentum}`,
    `Volume: ${r.volume}`,
    `Support: ${r.support}`,
    `Resistance: ${r.resistance}`,
    '',
    '🎯 Trigger:',
    r.trigger,
    '',
    `Entry: ${r.entry}`,
    `SL: ${r.sl}`,
    `TP: ${r.tp}`,
    `Target: ${r.target}`,
    `R:R: ${r.rr}`,
    '',
    '💡 Kesimpulan:',
    r.conclusion,
    '',
    '⚠️ Data EOD, bukan realtime.',
    'Entry hanya setelah trigger valid.',
  ].join('\n');
}
