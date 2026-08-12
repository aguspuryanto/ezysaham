import { TriangleAlert } from 'lucide-react';
import { DataFreshness } from '@/domain/analysis/dataFreshness';
import { cn } from '@/lib/format';

function formatId(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00Z`).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** Compact pill for placement next to the ticker/price header. */
export function DataFreshnessPill({ freshness }: { freshness: DataFreshness }) {
  const label =
    freshness.tier === 'fresh'
      ? `Data Update · ${formatId(freshness.lastBarDate)}`
      : `Data H-${freshness.ageInTradingDays} · ${formatId(freshness.lastBarDate)}`;

  return (
    <span className="inline-flex items-center text-sm font-semibold">
      {label}
    </span>
  );
}

/** Full-width warning banner, shown only when data is stale (3+ trading days old). */
export function DataFreshnessStaleBanner({ freshness }: { freshness: DataFreshness }) {
  if (freshness.tier !== 'stale') return null;
  return (
    <div className="flex gap-2.5 neo-border bg-rose-50 dark:bg-rose-400/10 px-4 py-3">
      <TriangleAlert className="mt-0.5 size-4 shrink-0 text-rose-500" strokeWidth={2.5} />
      <p className="text-xs text-rose-800 dark:text-rose-300 leading-relaxed">
        <strong>⚠️ DATA STALE</strong> — data terakhir {formatId(freshness.lastBarDate)} ({freshness.ageInTradingDays} hari
        bursa lalu). Sinyal di bawah ini <strong>tidak cocok dijadikan dasar keputusan Day Trading/ARA hari ini</strong>{' '}
        — pertimbangkan hanya untuk analisis Swing/Position, dan verifikasi harga terbaru sebelum mengambil keputusan.
      </p>
    </div>
  );
}
