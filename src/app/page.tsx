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
          <div className="max-w-full space-y-3">
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
          <div className="max-w-full space-y-3 border-t border-slate-700 pt-6">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-300">Disclaimer</h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              Jawaban singkatnya: <span className="font-semibold text-slate-300">tidak ada yang bisa menjamin profit 100% di pasar saham</span>,
              baik itu AI, manusia, maupun kombinasi keduanya.
            </p>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-slate-300">1. Kenapa AI Tidak Bisa Menjamin Profit?</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                AI pada dasarnya bekerja dengan mempelajari data masa lalu (harga historis, laporan keuangan, transaksi broker summary,
                hingga berita) untuk mencari pola.
              </p>
              <ul className="list-disc list-inside text-sm text-slate-400 leading-relaxed space-y-1">
                <li><span className="font-semibold text-slate-300">Pasar Saham Itu Dinamis:</span> AI sangat jago mengolah jutaan data dalam hitungan detik untuk menghitung probabilitas. Namun, pasar saham dipengaruhi oleh emosi manusia (ketakutan, keserakahan) dan ketidakpastian masa depan (kebijakan politik mendadak, perang, atau bencana).</li>
                <li><span className="font-semibold text-slate-300">Fenomena Garbage In, Garbage Out:</span> Jika data yang masuk tidak lengkap atau ada peristiwa mendadak (black swan event) yang belum pernah terjadi sebelumnya, prediksi AI tetap bisa salah.</li>
                <li><span className="font-semibold text-slate-300">Fungsi AI yang Sebenarnya:</span> AI bukan alat penerawang masa depan, melainkan alat bantu navigasi. AI membantu memperbesar probabilitas kemenangan dan memangkas waktu analisis, bukan menghilangkan risiko rugi (loss).</li>
              </ul>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-slate-300">2. AI vs. Human-Based: Bedanya di Mana?</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                AI dan manusia punya kelebihan serta kekurangan masing-masing:
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-slate-400 border-collapse">
                  <thead>
                    <tr className="border-b border-slate-700 text-slate-300">
                      <th className="text-left font-semibold py-1.5 pr-4">Aspek</th>
                      <th className="text-left font-semibold py-1.5 pr-4">Analisis Berbasis AI</th>
                      <th className="text-left font-semibold py-1.5">Analisis Manusia (Human-Based)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-slate-800 align-top">
                      <td className="py-1.5 pr-4 font-medium text-slate-300">Kecepatan &amp; Kapasitas</td>
                      <td className="py-1.5 pr-4">Sangat cepat, sanggup memproses ribuan data &amp; saham sekaligus.</td>
                      <td className="py-1.5">Terbatas, butuh waktu lama untuk menganalisis satu per satu.</td>
                    </tr>
                    <tr className="border-b border-slate-800 align-top">
                      <td className="py-1.5 pr-4 font-medium text-slate-300">Emosi (Psikologi)</td>
                      <td className="py-1.5 pr-4">Objektif 100%, disiplin jalankan cut loss atau take profit.</td>
                      <td className="py-1.5">Rentan kena FOMO (takut ketinggalan) atau Panic Selling.</td>
                    </tr>
                    <tr className="align-top">
                      <td className="py-1.5 pr-4 font-medium text-slate-300">Fleksibilitas Nuansa</td>
                      <td className="py-1.5 pr-4">Kaku, kesulitan membaca intuisi, rumor lokal, atau gimmick direksi.</td>
                      <td className="py-1.5">Mampu memahami konteks kualitatif, storytelling bisnis, &amp; emosi pasar.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="text-sm text-slate-400 leading-relaxed">
                <span className="font-semibold text-slate-300">Kesimpulannya:</span> Kombinasi terbaik justru ada di tengah-tengah. AI dipakai
                untuk mempercepat riset dan screening, sedangkan keputusan akhir serta pembacaan intuisi bisnis tetap di tangan manusia.
              </p>
            </div>
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
