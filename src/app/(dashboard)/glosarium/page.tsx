import type { Metadata } from "next";
import Link from "next/link";
import { GlossaryBrowser } from "@/components/glossary/GlossaryBrowser";

export const metadata: Metadata = {
  title: "Glosarium Istilah Saham",
  description: "Penjelasan singkat istilah saham untuk investor pemula: PER, PBV, ROE, dividend yield, payout ratio, free float, value trap, dan lainnya.",
};

export default function GlossaryPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Glosarium</h1>
        <p className="text-sm text-muted-foreground">
          Arti istilah yang dipakai di Ezysaham, dijelaskan untuk investor pemula. Klik ikon tanda tanya atau istilah bergaris bawah titik-titik di screener dan halaman saham untuk penjelasan singkat.
        </p>
      </div>

      <GlossaryBrowser />

      <p className="border-t pt-4 text-xs text-muted-foreground">
        Penjelasan ini bersifat edukasi umum dan bukan ajakan membeli atau menjual saham tertentu. Ingin belajar lebih lanjut? Lihat{" "}
        <Link href="/news" className="font-medium text-primary hover:underline">Tips & Edukasi</Link>.
      </p>
    </div>
  );
}
