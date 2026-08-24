import Link from 'next/link';
import { BookOpen, Compass, GitCompare, LineChart, ListFilter, Star } from 'lucide-react';
import { ContentHeader } from '@/presentation/components/layout/ContentHeader';

const STEPS = [
  {
    icon: ListFilter,
    title: '1. Pilih Gaya Trading (Preset)',
    body: (
      <>
        Di halaman Screener, pilih salah satu tab preset sesuai gaya Anda: <strong>Semua</strong> (tanpa
        filter khusus), <strong>Day Trading</strong> (fokus momentum & likuiditas harian),{' '}
        <strong>Swing Hunter</strong> (tren jangka menengah beberapa hari–minggu), atau{' '}
        <strong>Fundamental</strong> (kualitas keuangan perusahaan, cocok untuk investasi jangka panjang).
        Belum yakin istilahnya? Lihat penjelasan lengkap di{' '}
        <Link href="/panduan" className="font-bold underline underline-offset-2">
          halaman Panduan
        </Link>
        .
      </>
    ),
  },
  {
    icon: LineChart,
    title: '2. Baca Skor & Kolom Hasil',
    body: (
      <>
        Setiap saham yang lolos preset ditampilkan dengan <strong>Skor</strong> komposit, perubahan
        harga harian, harga terakhir, volume, kapitalisasi pasar, P/E, dan sektor. Skor tinggi bukan
        jaminan harga akan naik — selalu buka kartu/detail saham untuk membaca alasan di balik skor
        tersebut sebelum memutuskan apa pun.
      </>
    ),
  },
  {
    icon: Star,
    title: '3. Simpan ke Watchlist',
    body: (
      <>
        Klik ikon bintang pada baris saham untuk menambahkannya ke watchlist pribadi Anda. Watchlist
        dapat diakses lewat tombol filter (ikon di sebelah logo, pada tampilan mobile) atau panel
        samping (pada tampilan desktop).
      </>
    ),
  },
  {
    icon: GitCompare,
    title: '4. Bandingkan Dua Saham',
    body: (
      <>
        Gunakan ikon <strong>Bandingkan</strong> pada baris saham (maksimal 2 saham sekaligus), atau
        buka langsung halaman{' '}
        <Link href="/compare" className="font-bold underline underline-offset-2">
          Bandingkan Saham
        </Link>{' '}
        untuk melihat perbandingan harga dan data fundamental berdampingan.
      </>
    ),
  },
  {
    icon: Compass,
    title: '5. Buka Analisis Mendalam',
    body: (
      <>
        Klik ticker saham mana pun untuk membuka halaman analisis lengkap: indikator teknikal, riwayat
        harga, dan ringkasan fundamental untuk saham tersebut secara individual.
      </>
    ),
  },
  {
    icon: BookOpen,
    title: '6. Ulangi Secara Rutin',
    body: (
      <>
        Data yang digunakan adalah data <strong>akhir hari (EOD)</strong>, bukan real-time. Waktu
        terbaik untuk mengecek Screener adalah setelah jam perdagangan bursa tutup, atau sebelum
        sesi pembukaan esok hari, untuk melihat kandidat saham terbaru.
      </>
    ),
  },
];

const TIPS = [
  'Baru mulai? Coba preset Fundamental terlebih dahulu — lebih mudah dipahami dibanding preset teknikal.',
  'Jangan menaruh seluruh modal pada satu saham; sebar risiko ke beberapa saham/sektor.',
  'Selalu tentukan batas rugi (stop loss) sebelum membeli, bukan setelah harga turun.',
  'Skor dan badge di EzySaham adalah alat bantu analisis, bukan sinyal beli/jual otomatis.',
  'Karena data bersifat EOD, jangan jadikan EzySaham sebagai acuan tunggal untuk keputusan intraday yang cepat.',
];

export function TutorialPage() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <ContentHeader active="tutorial" />

      <main className="mx-auto max-w-4xl space-y-8 px-4 py-8 pb-16 sm:px-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold uppercase tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-3xl">
            Tutorial Menggunakan EzySaham AI
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            Panduan singkat langkah demi langkah untuk mulai menggunakan Screener EzySaham AI, dari
            memilih preset hingga membaca hasil analisisnya.
          </p>
        </div>

        <div className="space-y-4">
          {STEPS.map(({ icon: Icon, title, body }) => (
            <div key={title} className="flex gap-4 neo-border neo-shadow bg-white p-5 dark:bg-zinc-900">
              <span className="flex size-10 shrink-0 items-center justify-center neo-border bg-(--neo-accent) text-black">
                <Icon className="size-5" strokeWidth={2.5} />
              </span>
              <div className="space-y-1.5">
                <h2 className="font-bold uppercase tracking-wide text-zinc-900 dark:text-zinc-50">
                  {title}
                </h2>
                <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{body}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="neo-border neo-shadow bg-emerald-50 p-5 dark:bg-emerald-950/40">
          <h2 className="mb-3 font-bold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
            Tips untuk Pemula
          </h2>
          <ul className="space-y-2">
            {TIPS.map((tip) => (
              <li key={tip} className="flex gap-2 text-sm leading-relaxed text-emerald-800 dark:text-emerald-300">
                <span className="mt-0.5 shrink-0 font-bold">✓</span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-wrap items-center gap-3 neo-border neo-shadow bg-white p-5 dark:bg-zinc-900">
          <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            Belum familiar dengan istilah teknikal seperti RSI atau MACD?
          </p>
          <Link
            href="/panduan"
            className="neo-press ml-auto neo-border bg-(--neo-accent) px-4 py-2 text-sm font-bold uppercase tracking-wide text-black neo-shadow-sm"
          >
            Buka Panduan Istilah
          </Link>
        </div>
      </main>
    </div>
  );
}
