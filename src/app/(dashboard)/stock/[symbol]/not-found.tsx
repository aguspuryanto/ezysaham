import Link from "next/link";
import { buttonClass } from "@/components/ui/button";

export default function StockNotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-20 text-center">
      <h1 className="text-lg font-semibold">Saham tidak ditemukan</h1>
      <p className="text-sm text-muted-foreground">Kode saham tidak terdaftar atau sedang tidak diperdagangkan.</p>
      <Link href="/screener" className={buttonClass("outline")}>
        Cari di screener
      </Link>
    </div>
  );
}
