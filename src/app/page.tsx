import Link from "next/link";
import { ScreenerPage } from "@/presentation/features/screener/ScreenerPage";
import { Analytics } from '@vercel/analytics/next';

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-white text-black">

      {/* Content */}
      <main className="flex-1">
        <ScreenerPage />
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-100">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 space-y-6">
          <div className="max-w-3xl space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-300">Apa itu EzySaham AI?</h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              EzySaham AI adalah alat bantu screening saham BEI/IDX yang menerjemahkan data harga, volume, berita, dan skor fundamental
              menjadi rekomendasi sederhana (BUY, WATCHLIST, AVOID) — tanpa Anda perlu memahami istilah teknikal seperti RSI atau MACD.
              Setiap saham dianalisis lewat beberapa gaya trading (Day Trading, Swing Hunter, Fundamental, Bandar Detector) dan diberi
              skor otomatis beserta alasannya.
            </p>
            <p className="text-sm text-slate-400 leading-relaxed">
              Data yang digunakan adalah data akhir hari (EOD), bukan real-time, dan seluruh skor/rekomendasi bersifat bantu analisis
              edukatif — bukan nasihat keuangan resmi. Selalu terapkan manajemen risiko sendiri sebelum mengambil keputusan investasi.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-slate-700 pt-4">
            <Link href="/tutorial" className="text-sm hover:text-slate-300 transition-colors">Tutorial</Link>
            <Link href="/panduan" className="text-sm hover:text-slate-300 transition-colors">Panduan</Link>
            <Link href="/tentang" className="text-sm hover:text-slate-300 transition-colors">Tentang</Link>
          </div>
          <div className="flex items-center justify-between border-t border-slate-700 pt-4">
            <p className="text-sm">© 2026 EzySaham AI. All rights reserved.</p>
            <div className="flex space-x-4">
              <a href="#" className="hover:text-slate-300 transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-slate-300 transition-colors">Terms of Service</a>
            </div>
          </div>
        </div>
      </footer>
      <Analytics />
    </div>
  );
}
