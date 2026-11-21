import type { Metadata } from "next";
import { PortfolioView } from "@/components/portfolio/PortfolioView";

export const metadata: Metadata = { title: "Portofolio" };

export default function PortfolioPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Portofolio Saya</h1>
        <p className="text-sm text-muted-foreground">
          Catat saham yang kamu miliki untuk memantau nilai pasar, untung/rugi, dan diversifikasi.
        </p>
      </div>
      <PortfolioView />
    </div>
  );
}
