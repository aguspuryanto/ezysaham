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
        <div className="container mx-auto px-6 py-8 space-y-6">
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
