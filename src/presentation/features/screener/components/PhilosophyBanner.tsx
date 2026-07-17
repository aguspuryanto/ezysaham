'use client';

/**
 * PhilosophyBanner.tsx
 *
 * Value-prop + disclaimer strip for the Screener main column.
 *
 * Core message:
 *   "Apakah saham ini layak dibeli hari ini?"
 *   — answered in plain language, not 50 indicators.
 */

import { useState } from 'react';
import { ChevronDown, ChevronUp, Sparkles, TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/format';

const EXAMPLE_POINTS = [
  {
    icon: '✅',
    tone: 'green' as const,
    text: 'Likuiditas sangat baik',
    sub: 'Nilai transaksi Rp 125 miliar — mudah masuk & keluar',
  },
  {
    icon: '✅',
    tone: 'green' as const,
    text: 'Tren naik terkonfirmasi',
    sub: 'EMA20 > EMA50, harga bertahan di atas kedua EMA',
  },
  {
    icon: '✅',
    tone: 'green' as const,
    text: 'Momentum kuat',
    sub: 'MACD bullish, RSI 64 — masih ada ruang naik',
  },
  {
    icon: '⚠️',
    tone: 'amber' as const,
    text: 'Sudah dekat resistance',
    sub: 'Potensi upside tinggal ±3%, perlu konfirmasi breakout',
  },
];

const TONE_STYLES = {
  green:
    'border-emerald-200 bg-emerald-50 dark:border-emerald-400/20 dark:bg-emerald-400/5',
  amber:
    'border-amber-200 bg-amber-50 dark:border-amber-400/20 dark:bg-amber-400/5',
};

const TEXT_TONE = {
  green: 'text-emerald-700 dark:text-emerald-300',
  amber: 'text-amber-700 dark:text-amber-300',
};

const SUB_TONE = {
  green: 'text-emerald-600/80 dark:text-emerald-400/70',
  amber: 'text-amber-600/80 dark:text-amber-400/70',
};

export function PhilosophyBanner() {
  const [open, setOpen] = useState(false);

  return (
    <div className="mb-1 overflow-hidden rounded-2xl border border-blue-200/70 bg-gradient-to-br from-blue-50 to-indigo-50/60 dark:border-blue-400/15 dark:from-blue-950/40 dark:to-indigo-950/30">
      {/* ── Collapsed header (always visible) ───────────────────────── */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-blue-100/50 dark:hover:bg-blue-900/20"
        aria-expanded={open}
        id="philosophy-banner-toggle"
      >
        <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-blue-600 dark:bg-blue-500">
          <Sparkles className="size-3.5 text-white" strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">
            Filosofi EzySaham — satu pertanyaan yang penting
          </p>
          <p className="mt-0.5 truncate text-xs text-blue-600 dark:text-blue-400">
            "Apakah saham ini layak dibeli hari ini?" — dijawab dalam bahasa manusia, bukan 50 indikator
          </p>
        </div>
        <span className="shrink-0 text-blue-400 dark:text-blue-500">
          {open ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </span>
      </button>

      {/* ── Expanded body ────────────────────────────────────────────── */}
      {open && (
        <div className="border-t border-blue-200/60 dark:border-blue-400/10 px-5 pb-5 pt-4 space-y-4">
          {/* Headline */}
          <div>
            <h3 className="text-base font-bold text-blue-900 dark:text-blue-100">
              "Apakah saham ini layak dibeli hari ini?"
            </h3>
            <p className="mt-1 text-sm text-blue-700/80 dark:text-blue-300/80 leading-relaxed">
              Kebanyakan aplikasi saham menampilkan puluhan indikator hingga membingungkan pemula.
              EzySaham menjawab satu pertanyaan sederhana tersebut dengan bahasa yang mudah
              dipahami — bukan angka-angka mentah.
            </p>
          </div>

          {/* Example output */}
          <div>
            <p className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-blue-500 dark:text-blue-400">
              Contoh Analisis AI
            </p>
            <div className="space-y-2">
              {EXAMPLE_POINTS.map((pt) => (
                <div
                  key={pt.text}
                  className={cn(
                    'flex items-start gap-3 rounded-xl border px-3.5 py-2.5',
                    TONE_STYLES[pt.tone]
                  )}
                >
                  <span className="mt-0.5 shrink-0 text-base leading-none">{pt.icon}</span>
                  <div>
                    <span className={cn('text-sm font-semibold', TEXT_TONE[pt.tone])}>
                      {pt.text}
                    </span>
                    <span className={cn('ml-1.5 text-sm', SUB_TONE[pt.tone])}>
                      ({pt.sub})
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Conclusion chip */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-blue-200 dark:border-blue-400/20 bg-white dark:bg-blue-900/30 px-3 py-1 text-xs font-semibold text-blue-700 dark:text-blue-300">
                💬 Kesimpulan
              </span>
              <span className="text-sm text-blue-800 dark:text-blue-200">
                Cocok untuk{' '}
                <strong className="text-emerald-600 dark:text-emerald-400">swing</strong>,
                kurang ideal untuk{' '}
                <strong className="text-amber-600 dark:text-amber-400">scalping</strong>.
              </span>
            </div>
          </div>

          {/* Disclaimer */}
          <div className="flex gap-2.5 rounded-xl border border-amber-200 dark:border-amber-400/20 bg-amber-50 dark:bg-amber-400/5 px-4 py-3">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-500" strokeWidth={2} />
            <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
              <strong>Disclaimer:</strong> Seluruh analisis di EzySaham bersifat
              <strong> edukatif</strong> dan dihasilkan dari data historis EOD (End-of-Day).{' '}
              <strong>Bukan merupakan rekomendasi beli/jual.</strong> Selalu lakukan riset mandiri,
              konsultasikan dengan penasihat keuangan terdaftar, dan terapkan manajemen risiko yang
              ketat sebelum mengambil keputusan investasi.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
