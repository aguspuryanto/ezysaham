"use client";
import Link from "next/link";
import { Cloud, CloudOff, HardDrive, RefreshCw, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/AuthProvider";
import { usePortfolio } from "@/hooks/usePortfolio";

/** Menjelaskan di mana portofolio disimpan + tawaran impor data lokal setelah login. */
export function StorageBanner() {
  const { configured, user } = useAuth();
  const { mode, syncing, error, pendingImport, pendingSales, importLocal, dismissImport, retry } = usePortfolio();

  return (
    <div className="space-y-3">
      {(pendingImport.length > 0 || pendingSales.length > 0) && (
        <div className="flex flex-col gap-3 rounded-xl border border-primary/40 bg-primary/5 p-4 sm:flex-row sm:items-center">
          <Upload className="size-5 shrink-0 text-primary" />
          <div className="flex-1 text-sm">
            <p className="font-semibold">Impor portofolio dari perangkat ini?</p>
            <p className="text-muted-foreground">
              {pendingImport.length > 0 && (
                <>
                  Ada {pendingImport.length} saham ({pendingImport.map((h) => h.symbol).slice(0, 5).join(", ")}
                  {pendingImport.length > 5 ? ", …" : ""}) yang tersimpan di browser ini sebelum login. Saham yang sama akan digabung dengan harga rata-rata.{" "}
                </>
              )}
              {pendingSales.length > 0 && <>{pendingSales.length} catatan penjualan juga akan ikut diimpor.</>}
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={dismissImport}>Abaikan</Button>
            <Button size="sm" onClick={() => void importLocal()}>Impor ke akun</Button>
          </div>
        </div>
      )}

      {error && (
        <div role="alert" className="flex items-center gap-3 rounded-xl bg-down-soft p-3 text-sm text-down">
          <CloudOff className="size-4 shrink-0" />
          <span className="flex-1">{error}</span>
          <Button size="sm" variant="outline" onClick={retry}>Coba lagi</Button>
        </div>
      )}

      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        {mode === "remote" ? (
          <>
            {syncing ? <RefreshCw className="size-3.5 animate-spin" /> : <Cloud className="size-3.5 text-up" />}
            {syncing ? "Menyinkronkan…" : <>Tersimpan di akun <span className="font-medium text-foreground">{user?.email}</span> — bisa dibuka dari perangkat mana pun.</>}
          </>
        ) : (
          <>
            <HardDrive className="size-3.5" />
            Tersimpan di browser ini saja.
            {configured && (
              <Link href="/login" className="font-medium text-primary hover:underline">
                Masuk dengan email agar portofolio aman & tersinkron.
              </Link>
            )}
          </>
        )}
      </p>
    </div>
  );
}
