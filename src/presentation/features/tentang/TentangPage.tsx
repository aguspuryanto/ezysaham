import Link from 'next/link';
import { Compass, Layers, ShieldAlert, Sparkles } from 'lucide-react';
import { ContentHeader } from '@/presentation/components/layout/ContentHeader';
import { SITE_NAME } from '@/lib/site';

const SECTIONS = [
  {
    icon: Sparkles,
    title: 'Apa itu EzySaham AI?',
    body: (
      <>
        {SITE_NAME} adalah alat bantu screening saham Bursa Efek Indonesia (BEI/IDX) yang
        menerjemahkan data harga, volume, dan rasio fundamental menjadi kesimpulan yang lebih mudah
        dibaca, dibanding harus membaca puluhan indikator mentah satu per satu. Tujuannya sederhana:
        membantu trader/investor ritel Indonesia mempersempit ribuan saham menjadi beberapa puluh
        kandidat yang layak diriset lebih lanjut.
      </>
    ),
  },
  {
    icon: Layers,
    title: 'Bagaimana Cara Kerjanya?',
    body: (
      <>
        Setiap kali Screener dibuka, sistem memindai hampir 1.000 saham di BEI menggunakan data{' '}
        <strong>akhir hari (EOD — End of Day)</strong>, bukan data real-time. Setiap saham diberi
        skor berdasarkan preset yang dipilih (Day Trading, Swing Hunter, atau Fundamental), lalu
        diurutkan agar Anda bisa fokus pada kandidat dengan setup paling relevan untuk gaya trading
        Anda.
      </>
    ),
  },
  {
    icon: Compass,
    title: 'Filosofi Desain',
    body: (
      <>
        &ldquo;Apakah saham ini layak dibeli hari ini?&rdquo; — itu satu pertanyaan yang coba dijawab
        {' '}{SITE_NAME} lewat bahasa yang mudah dipahami, bukan sekadar menumpuk angka mentah.
        Kami sadar banyak aplikasi saham menampilkan puluhan indikator sekaligus hingga membingungkan
        pemula — {SITE_NAME} masih dalam proses menyederhanakan hal ini secara bertahap, dan halaman{' '}
        <Link href="/panduan" className="font-bold underline underline-offset-2">
          Panduan
        </Link>{' '}
        ini adalah salah satu langkah ke arah itu.
      </>
    ),
  },
  {
    icon: ShieldAlert,
    title: 'Keterbatasan & Disclaimer',
    body: (
      <div className="space-y-2">
        <p>
          Seluruh analisis, skor, dan badge di {SITE_NAME} bersifat <strong>edukatif</strong> dan
          dihasilkan dari data historis EOD — <strong>bukan merupakan nasihat keuangan resmi</strong>{' '}
          maupun rekomendasi beli/jual.
        </p>
        <p>
          Beberapa fitur, seperti pendeteksi aktivitas &ldquo;pemain besar&rdquo; (bandarmology),
          bersifat perkiraan (proxy) dari pola harga dan volume historis — data resmi broker summary
          maupun aliran dana asing tidak tersedia gratis untuk publik di IDX, sehingga fitur semacam
          ini tidak boleh dianggap sebagai kepastian.
        </p>
        <p>
          Selalu lakukan riset mandiri, terapkan manajemen risiko yang ketat, dan pertimbangkan
          berkonsultasi dengan penasihat keuangan berlisensi sebelum mengambil keputusan investasi.
        </p>
      </div>
    ),
  },
];

export function TentangPage() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <ContentHeader active="tentang" />

      <main className="mx-auto max-w-4xl space-y-6 px-4 py-8 pb-16 sm:px-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold uppercase tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-3xl">
            Tentang {SITE_NAME}
          </h1>
        </div>

        <div className="space-y-4">
          {SECTIONS.map(({ icon: Icon, title, body }) => (
            <div key={title} className="flex gap-4 neo-border neo-shadow bg-white p-5 dark:bg-zinc-900">
              <span className="flex size-10 shrink-0 items-center justify-center neo-border bg-(--neo-accent) text-black">
                <Icon className="size-5" strokeWidth={2.5} />
              </span>
              <div className="min-w-0 space-y-1.5">
                <h2 className="font-bold uppercase tracking-wide text-zinc-900 dark:text-zinc-50">
                  {title}
                </h2>
                <div className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{body}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3 neo-border neo-shadow bg-white p-5 dark:bg-zinc-900">
          <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            Baru pertama kali di sini?
          </p>
          <Link
            href="/tutorial"
            className="neo-press ml-auto neo-border bg-(--neo-accent) px-4 py-2 text-sm font-bold uppercase tracking-wide text-black neo-shadow-sm"
          >
            Mulai dari Tutorial
          </Link>
        </div>
      </main>
    </div>
  );
}
