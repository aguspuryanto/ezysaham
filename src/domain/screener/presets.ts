import { OHLCVBar } from '@/domain/models/History';
import { StockSummary } from '@/domain/models/Stock';
import { ema, lastValid, sma } from '@/domain/indicators/movingAverages';
import { macd } from '@/domain/indicators/macd';
import { rsi } from '@/domain/indicators/rsi';
import { relativeVolume } from '@/domain/indicators/volume';

/** IDX board lot size: 1 lot = 100 shares. */
export const LOT_SIZE = 100;

export type ScreenerPresetId = 'ara' | 'bpjs' | 'momentum';

export interface PresetEvaluation {
  passed: boolean;
  reasons: string[];
  failed: string[];
}

export interface ScreenerPreset {
  id: ScreenerPresetId;
  label: string;
  description: string;
  /** Static display copy of the criteria below, for UI panels that explain the active filter. */
  criteria: string[];
  /** Cheap, summary-only check used to shortlist candidates before fetching OHLCV history. */
  coarseFilter: (s: StockSummary) => boolean;
  /** Full check once OHLCV bars are available for a shortlisted candidate. */
  evaluate: (s: StockSummary, bars: OHLCVBar[]) => PresetEvaluation;
}

function verdict(checks: Array<[boolean, string]>): PresetEvaluation {
  const reasons: string[] = [];
  const failed: string[] = [];
  for (const [ok, label] of checks) {
    (ok ? reasons : failed).push(label);
  }
  return { passed: failed.length === 0, reasons, failed };
}

const araPreset: ScreenerPreset = {
  id: 'ara',
  label: 'ARA',
  description: 'Saham yang sedang menuju/mendekati auto rejection atas, didukung volume yang menguat.',
  criteria: ['Harga > 100', 'Return 1 hari > 10%', 'Volume > 20.000 lot', 'Volume MA5 > Volume MA20'],
  coarseFilter: (s) =>
    s.lastClose > 100 && s.percentChange1D > 10 && s.volume > 20_000 * LOT_SIZE,
  evaluate: (s, bars) => {
    const volumes = bars.map((b) => b.volume);
    const volMa5 = lastValid(sma(volumes, 5));
    const volMa20 = lastValid(sma(volumes, 20));
    return verdict([
      [s.lastClose > 100, 'Harga > 100'],
      [s.percentChange1D > 10, 'Return 1 hari > 10%'],
      [s.volume > 20_000 * LOT_SIZE, 'Volume > 20.000 lot'],
      [!Number.isNaN(volMa5) && !Number.isNaN(volMa20) && volMa5 > volMa20, 'Volume MA5 > Volume MA20'],
    ]);
  },
};

const bpjsPreset: ScreenerPreset = {
  id: 'bpjs',
  label: 'BPJS',
  description: 'Breakout dengan konfirmasi harga dan volume di atas rata-rata — mengejar momentum harian.',
  criteria: [
    'Harga > MA5',
    'Close > Prev Close x 1.05',
    'Close > Open',
    'Volume > 120% volume hari sebelumnya',
    'Nilai transaksi > Rp 5 miliar',
  ],
  coarseFilter: (s) => s.value > 5_000_000_000 && s.percentChange1D > 5,
  evaluate: (s, bars) => {
    const lastBar = bars[bars.length - 1];
    const prevBar = bars[bars.length - 2];
    const ma5 = lastValid(sma(bars.map((b) => b.close), 5));
    return verdict([
      [!Number.isNaN(ma5) && s.lastClose > ma5, 'Harga > MA5'],
      [s.lastClose > s.prevClose * 1.05, 'Close > Prev Close x 1.05'],
      [!!lastBar && s.lastClose > lastBar.open, 'Close > Open'],
      [!!prevBar && s.volume > prevBar.volume * 1.2, 'Volume > 120% volume hari sebelumnya'],
      [s.value > 5_000_000_000, 'Nilai transaksi > Rp 5 miliar'],
    ]);
  },
};

const momentumPreset: ScreenerPreset = {
  id: 'momentum',
  label: 'Momentum',
  description: 'Trend naik yang sudah terkonfirmasi EMA, MACD, RSI, dan lonjakan volume relatif.',
  criteria: [
    'EMA20 > EMA50',
    'Close > EMA20',
    'MACD bullish',
    'RSI antara 55-70',
    'RVOL > 2',
    'Nilai transaksi > Rp 20 miliar',
  ],
  coarseFilter: (s) => s.value > 20_000_000_000,
  evaluate: (s, bars) => {
    const closes = bars.map((b) => b.close);
    const ema20 = lastValid(ema(closes, 20));
    const ema50 = lastValid(ema(closes, 50));
    const { macdLine, signalLine } = macd(bars);
    const macdLast = lastValid(macdLine);
    const signalLast = lastValid(signalLine);
    const rsiLast = lastValid(rsi(bars, 14));
    const rvol = relativeVolume(bars, 20);

    return verdict([
      [!Number.isNaN(ema20) && !Number.isNaN(ema50) && ema20 > ema50, 'EMA20 > EMA50'],
      [!Number.isNaN(ema20) && s.lastClose > ema20, 'Close > EMA20'],
      [!Number.isNaN(macdLast) && !Number.isNaN(signalLast) && macdLast > signalLast, 'MACD bullish'],
      [!Number.isNaN(rsiLast) && rsiLast >= 55 && rsiLast <= 70, 'RSI antara 55-70'],
      [!Number.isNaN(rvol) && rvol > 2, 'RVOL > 2'],
      [s.value > 20_000_000_000, 'Nilai transaksi > Rp 20 miliar'],
    ]);
  },
};

export const SCREENER_PRESETS: Record<ScreenerPresetId, ScreenerPreset> = {
  ara: araPreset,
  bpjs: bpjsPreset,
  momentum: momentumPreset,
};

export const SCREENER_PRESET_LIST: ScreenerPreset[] = [araPreset, bpjsPreset, momentumPreset];
