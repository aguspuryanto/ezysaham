import { Cpu, ShieldAlert, Sparkles } from 'lucide-react';

export function TerminalFooterBanner() {
  return (
    <div className="mx-4 mb-3.5 flex flex-col gap-3 rounded-lg border border-(--term-cyan-border) bg-(--term-surface-tint) p-4 sm:mx-5 sm:flex-row sm:items-start">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-md border border-(--term-cyan-border) bg-(--term-surface)">
        <Sparkles className="size-4" style={{ color: 'var(--term-cyan-strong)' }} strokeWidth={2} />
      </div>
      <div className="flex-1">
        <p className="text-sm font-bold text-(--term-text)">Filosofi EzySaham — satu pertanyaan yang penting</p>
        <p className="mt-1 text-xs italic leading-relaxed text-(--term-muted)">
          &quot;Apakah saham ini layak dibeli hari ini?&quot; — Setiap kali Anda membuka EzySaham, AI menganalisis hampir 1.000 saham
          di Bursa Efek Indonesia dan memilih sekitar 20–30 saham dengan setup terbaik untuk dipantau, lengkap dengan alasan
          pemilihan, level support–resistance, dan skenario bullish maupun bearish.
        </p>
      </div>
    </div>
  );
}

export function TerminalInfoCards() {
  return (
    <div className="mx-4 mb-3.5 grid grid-cols-1 gap-3 sm:mx-5 md:grid-cols-2">
      <div className="rounded-lg border border-(--term-border) bg-(--term-surface) p-4">
        <div className="mb-2 flex items-center gap-2">
          <ShieldAlert className="size-4" style={{ color: 'var(--term-amber)' }} strokeWidth={2} />
          <span className="text-sm font-bold text-(--term-text)">Disclaimer Pasar Modal</span>
        </div>
        <p className="text-xs leading-relaxed text-(--term-muted)">
          Seluruh analisis di EzySaham bersifat edukatif dan dihasilkan dari data historis EOD (End-of-Day).{' '}
          <strong className="text-(--term-text)">Bukan merupakan rekomendasi beli/jual.</strong> Selalu lakukan riset mandiri,
          konsultasikan dengan penasihat keuangan terdaftar, dan terapkan manajemen risiko yang ketat sebelum mengambil
          keputusan investasi.
        </p>
      </div>
      <div className="rounded-lg border border-(--term-border) bg-(--term-surface) p-4">
        <div className="mb-2 flex items-center gap-2">
          <Cpu className="size-4" style={{ color: 'var(--term-cyan-strong)' }} strokeWidth={2} />
          <span className="text-sm font-bold text-(--term-text)">Analisis AI vs Analisis Manual</span>
        </div>
        <p className="text-xs leading-relaxed text-(--term-muted)">
          Algoritma memproses ratusan data harga, volume, dan rasio fundamental hampir 1.000 saham dalam hitungan detik,
          secara konsisten tanpa distorsi psikologis FOMO atau panic selling. AI menyaring kandidat terbaik dan menjelaskan
          alasannya — keputusan risiko dan eksekusi akhir tetap sepenuhnya di tangan Anda.
        </p>
      </div>
    </div>
  );
}
