import Link from "next/link";
import { buttonClass } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="text-5xl font-bold text-primary">404</p>
      <h1 className="text-lg font-semibold">Halaman tidak ditemukan</h1>
      <Link href="/" className={buttonClass("outline")}>
        Kembali ke beranda
      </Link>
    </div>
  );
}
