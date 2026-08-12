import { OHLCVBar } from '@/domain/models/History';
import { AccumDistHistoryResult, TechnicalEvent } from '@/domain/models/TechnicalHistory';

function percentChange1D(bars: OHLCVBar[], i: number): number {
  if (i < 1 || bars[i - 1].close === 0) return NaN;
  return ((bars[i].close - bars[i - 1].close) / bars[i - 1].close) * 100;
}

export function detectAccumDistEvents(bars: OHLCVBar[], rvol: number[], obv: number[]): AccumDistHistoryResult {
  const events: TechnicalEvent[] = [];

  for (let i = 5; i < bars.length; i++) {
    const r = rvol[i];
    if (Number.isNaN(r)) continue;
    const chg = percentChange1D(bars, i);
    const obvSlope5D = obv[i] - obv[i - 5];
    const metrics = {
      RVOL: `${r.toFixed(1)}×`,
      Perubahan: `${chg >= 0 ? '+' : ''}${chg.toFixed(1)}%`,
      'OBV 5D': obvSlope5D >= 0 ? '📈 Naik' : '📉 Turun',
    };

    if (r >= 3 && Math.abs(chg) < 1) {
      events.push({
        date: bars[i].date, category: 'accumDist', type: 'absorption', label: 'High-Volume Absorption',
        tone: 'neutral', icon: '🟣', metrics,
        summary: 'Volume sangat tinggi namun harga hampir tidak bergerak — indikasi absorption, perlu konfirmasi lanjutan.',
      });
    } else if (chg >= 0 && r >= 1.5 && obvSlope5D > 0) {
      events.push({
        date: bars[i].date, category: 'accumDist', type: 'accumulation', label: 'Accumulation',
        tone: 'bullish', icon: '🟢', metrics,
        summary: 'Kenaikan harga disertai volume di atas rata-rata dan OBV menguat — indikasi akumulasi, perlu konfirmasi lanjutan.',
      });
    } else if (chg <= -1 && r >= 1.5) {
      events.push({
        date: bars[i].date, category: 'accumDist', type: 'distribution', label: 'Distribution',
        tone: 'bearish', icon: '🔴', metrics,
        summary: 'Penurunan harga disertai volume di atas rata-rata — indikasi tekanan jual/distribusi.',
      });
    }
  }

  return { events: events.sort((a, b) => (a.date < b.date ? 1 : -1)) };
}
