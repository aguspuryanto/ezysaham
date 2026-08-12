import { OHLCVBar } from '@/domain/models/History';
import { sma } from '@/domain/indicators/movingAverages';
import { ExtremeVolumeBar, TechnicalEvent, VolumeHistoryResult } from '@/domain/models/TechnicalHistory';
import { formatCompact } from '@/lib/format';

/** RVOL per bar = volume / SMA20(volume), aligned 1:1 with `bars`. */
export function computeRvolSeries(bars: OHLCVBar[]): number[] {
  const volumes = bars.map((b) => b.volume);
  const volMa20 = sma(volumes, 20);
  return bars.map((_, i) => (volMa20[i] > 0 ? volumes[i] / volMa20[i] : NaN));
}

function percentChange1D(bars: OHLCVBar[], i: number): number {
  if (i < 1 || bars[i - 1].close === 0) return NaN;
  return ((bars[i].close - bars[i - 1].close) / bars[i - 1].close) * 100;
}

function fmtChg(chg: number): string {
  return Number.isNaN(chg) ? '–' : `${chg >= 0 ? '+' : ''}${chg.toFixed(1)}%`;
}

function extremeBar(bars: OHLCVBar[], rvol: number[], index: number, label: string): ExtremeVolumeBar {
  const bar = bars[index];
  const chg = percentChange1D(bars, index);
  const r = rvol[index];
  const interpretation = Number.isNaN(r)
    ? `Volume ${label.toLowerCase()} terjadi pada ${bar.date}.`
    : `Volume ${label.toLowerCase()} terjadi pada ${bar.date}, bersamaan dengan ${chg >= 0 ? 'kenaikan' : 'penurunan'} harga ${Math.abs(chg).toFixed(1)}%. Volume mencapai ${r.toFixed(1)}× rata-rata 20 hari.`;
  return { date: bar.date, volume: bar.volume, rvol: r, percentChange: chg, interpretation };
}

export function detectVolumeEvents(bars: OHLCVBar[], rvol: number[]): VolumeHistoryResult {
  const events: TechnicalEvent[] = [];

  for (let i = 1; i < bars.length; i++) {
    const r = rvol[i];
    if (Number.isNaN(r)) continue;
    const chg = percentChange1D(bars, i);
    const metrics = {
      Volume: formatCompact(bars[i].volume),
      RVOL: `${r.toFixed(1)}×`,
      Perubahan: fmtChg(chg),
    };

    if (r >= 5) {
      events.push({
        date: bars[i].date, category: 'volume', type: 'extreme_volume', label: 'Extreme Volume',
        tone: chg >= 0 ? 'bullish' : 'bearish', icon: '🚀', metrics,
        summary: `Volume ${r.toFixed(1)}× rata-rata 20 hari — aktivitas perdagangan sangat abnormal.`,
      });
    } else if (r >= 2 && chg >= 3) {
      events.push({
        date: bars[i].date, category: 'volume', type: 'volume_spike_up', label: 'Volume Spike (Buying Pressure)',
        tone: 'bullish', icon: '🟢', metrics,
        summary: `Volume ${r.toFixed(1)}× rata-rata disertai kenaikan harga ${chg.toFixed(1)}% — indikasi tekanan beli.`,
      });
    } else if (r >= 2 && chg <= -3) {
      events.push({
        date: bars[i].date, category: 'volume', type: 'volume_spike_down', label: 'Volume Spike (Selling Pressure)',
        tone: 'bearish', icon: '🔴', metrics,
        summary: `Volume ${r.toFixed(1)}× rata-rata disertai penurunan harga ${Math.abs(chg).toFixed(1)}% — indikasi tekanan jual.`,
      });
    } else if (r >= 2 && Math.abs(chg) < 1) {
      events.push({
        date: bars[i].date, category: 'volume', type: 'high_volume_absorption', label: 'High-Volume Absorption',
        tone: 'neutral', icon: '🟣', metrics,
        summary: 'Volume tinggi namun harga hampir tidak bergerak — indikasi absorption, perlu konfirmasi lanjutan.',
      });
    } else if (r <= 0.3) {
      events.push({
        date: bars[i].date, category: 'volume', type: 'volume_dry_up', label: 'Volume Rendah / Compression',
        tone: 'neutral', icon: '🔵', metrics,
        summary: 'Volume berada jauh di bawah rata-rata — partisipasi pasar rendah, sering mendahului fase konsolidasi.',
      });
    }
  }

  let maxIdx = -1, minIdx = -1;
  for (let i = 0; i < bars.length; i++) {
    if (maxIdx === -1 || bars[i].volume > bars[maxIdx].volume) maxIdx = i;
    if (minIdx === -1 || bars[i].volume < bars[minIdx].volume) minIdx = i;
  }

  return {
    events: events.sort((a, b) => (a.date < b.date ? 1 : -1)),
    maxVolumeBar: maxIdx >= 0 ? extremeBar(bars, rvol, maxIdx, 'tertinggi') : null,
    minVolumeBar: minIdx >= 0 ? extremeBar(bars, rvol, minIdx, 'terendah') : null,
  };
}
