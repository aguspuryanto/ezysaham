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
import { ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { cn } from '@/lib/format';
import { Badge } from '@/presentation/components/ui/badge';
import { Card } from '@/presentation/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/presentation/components/ui/collapsible';
import { TONE_DETAIL_TEXT, TONE_SURFACE, TONE_TEXT } from '@/presentation/components/ui/tone';

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

export function PhilosophyBanner() {
  const [open, setOpen] = useState(false);

  return (
    <Card className="mb-4 gap-0 overflow-hidden rounded-2xl border-blue-200/70 bg-gradient-to-br from-blue-50 to-indigo-50/60 py-0 shadow-none ring-0 dark:border-blue-400/15 dark:from-blue-950/40 dark:to-indigo-950/30">
      <Collapsible open={open} onOpenChange={setOpen}>
        {/* ── Collapsed header (always visible) ───────────────────────── */}
        <CollapsibleTrigger
          className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-blue-100/50 dark:hover:bg-blue-900/20"
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
              &quot;Apakah saham ini layak dibeli hari ini?&quot; — dijawab dalam bahasa manusia, bukan 50 indikator
            </p>
          </div>
          <span className="shrink-0 text-blue-400 dark:text-blue-500">
            {open ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </span>
        </CollapsibleTrigger>

        {/* ── Expanded body ────────────────────────────────────────────── */}
        <CollapsibleContent className="border-t border-blue-200/60 dark:border-blue-400/10 px-5 pb-5 pt-4 space-y-4">
          {/* Headline */}
          <div>
            <h3 className="text-base font-bold text-blue-900 dark:text-blue-100">
              &quot;Apakah saham ini layak dibeli hari ini?&quot;
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
                    TONE_SURFACE[pt.tone]
                  )}
                >
                  <span className="mt-0.5 shrink-0 text-base leading-none">{pt.icon}</span>
                  <div>
                    <span className={cn('text-sm font-semibold', TONE_TEXT[pt.tone])}>
                      {pt.text}
                    </span>
                    <span className={cn('ml-1.5 text-sm', TONE_DETAIL_TEXT[pt.tone])}>
                      ({pt.sub})
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Conclusion chip */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="rounded-full border-blue-200 bg-white text-xs font-semibold text-blue-700 dark:border-blue-400/20 dark:bg-blue-900/30 dark:text-blue-300">
                💬 Kesimpulan
              </Badge>
              <span className="text-sm text-blue-800 dark:text-blue-200">
                Cocok untuk{' '}
                <strong className="text-emerald-600 dark:text-emerald-400">swing</strong>,
                kurang ideal untuk{' '}
                <strong className="text-amber-600 dark:text-amber-400">scalping</strong>.
              </span>
            </div>
          </div>

          {/* Disclaimer */}
          {/* <Alert className="rounded-xl border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-400/20 dark:bg-amber-400/5">
            <TriangleAlert className="size-4 text-amber-500" strokeWidth={2} />
            <AlertDescription className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
              <strong>Disclaimer:</strong> Seluruh analisis di EzySaham bersifat
              <strong> edukatif</strong> dan dihasilkan dari data historis EOD (End-of-Day).{' '}
              <strong>Bukan merupakan rekomendasi beli/jual.</strong> Selalu lakukan riset mandiri,
              konsultasikan dengan penasihat keuangan terdaftar, dan terapkan manajemen risiko yang
              ketat sebelum mengambil keputusan investasi.
            </AlertDescription>
          </Alert> */}
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
