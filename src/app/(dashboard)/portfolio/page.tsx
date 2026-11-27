import type { Metadata } from "next";
import { PortfolioView } from "@/components/portfolio/PortfolioView";

export const metadata: Metadata = { title: "Portofolio" };

export default function PortfolioPage() {
  // Judul + tombol "Tambah Portofolio" ada di PortfolioView karena berbagi state buka/tutup form.
  return <PortfolioView />;
}
