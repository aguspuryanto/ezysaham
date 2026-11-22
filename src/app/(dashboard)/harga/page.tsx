import type { Metadata } from "next";
import { Suspense } from "react";
import { HandHeart, RefreshCcw, ShieldCheck, Sprout } from "lucide-react";
import { PricingCards } from "@/components/pricing/PricingCards";
import { PaymentStatus } from "@/components/pricing/PaymentStatus";
import { isDokuConfigured } from "@/lib/doku";
import { isSupabaseAdminConfigured } from "@/lib/supabase/admin";

// Tombol bayar aktif hanya bila DOKU & Supabase secret key sudah diisi di env
const paymentsEnabled = isDokuConfigured && isSupabaseAdminConfigured;

export const metadata: Metadata = {
  title: "Paket Membership",
  description: "Semua fitur inti EzySaham gratis selamanya. Jika bermanfaat, kamu bisa mendukung pengembangan lewat paket Pro.",
};

const FAQ = [
  {
    q: "Apakah fitur gratis akan dikurangi supaya saya membayar?",
    a: "Tidak. Fitur yang sekarang gratis akan tetap gratis. Paket Pro adalah cara sukarela untuk mendukung pengembangan, ditambah fitur ekstra.",
  },
  {
    q: "Apakah Pro diperpanjang otomatis?",
    a: "Tidak. Kamu membayar sekali untuk 1 bulan atau 1 tahun. Menjelang masa aktif berakhir, kami hanya mengirim pengingat — tidak ada penarikan dana otomatis.",
  },
  {
    q: "Apa yang terjadi saat masa Pro berakhir?",
    a: "Akun kembali ke Starter. Portofolio dan seluruh datamu tetap aman, tidak ada yang dihapus.",
  },
  {
    q: "Metode pembayaran apa yang tersedia?",
    a: "QRIS, virtual account bank, e-wallet, dan kartu kredit/debit melalui payment gateway berizin Bank Indonesia. Data kartu tidak pernah disimpan di server EzySaham.",
  },
];

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-10">
      <section className="space-y-3 pt-2 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-semibold text-muted-foreground">
          <HandHeart className="size-3.5 text-primary" /> Gratis selamanya · Dukung jika bermanfaat
        </span>
        <h1 className="text-3xl font-bold tracking-tight text-balance sm:text-4xl">
          Pakai gratis. <span className="text-primary">Bayar hanya kalau suka.</span>
        </h1>
        <p className="mx-auto max-w-xl text-muted-foreground">
          Semua fitur inti EzySaham bisa kamu pakai tanpa biaya. Kalau EzySaham membantu perjalanan investasimu, paket Pro adalah
          cara untuk ikut menjaga layanan ini tetap berjalan dan berkembang.
        </p>
      </section>

      <Suspense>
        <PaymentStatus />
      </Suspense>

      <PricingCards paymentsEnabled={paymentsEnabled} />

      <section className="grid gap-3 sm:grid-cols-3">
        {[
          { icon: Sprout, title: "Tanpa paksaan", text: "Tidak ada fitur inti yang dikunci, tidak ada iklan." },
          { icon: RefreshCcw, title: "Tanpa auto-debit", text: "Bayar per periode, perpanjang hanya jika kamu mau." },
          { icon: ShieldCheck, title: "Pembayaran aman", text: "Diproses payment gateway berizin Bank Indonesia." },
        ].map(({ icon: Icon, title, text }) => (
          <div key={title} className="flex gap-3 rounded-xl border bg-card p-4">
            <Icon className="mt-0.5 size-5 shrink-0 text-primary" />
            <div>
              <p className="text-sm font-semibold">{title}</p>
              <p className="text-xs text-muted-foreground">{text}</p>
            </div>
          </div>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Pertanyaan umum</h2>
        <div className="divide-y rounded-xl border bg-card">
          {FAQ.map((f) => (
            <details key={f.q} className="group p-4 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-medium">
                {f.q}
                <span className="text-lg leading-none text-muted-foreground transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
