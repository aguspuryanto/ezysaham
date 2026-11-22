"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CircleCheck, Info, Loader2 } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useMembership } from "@/hooks/useMembership";

type Phase = "checking" | "active" | "waiting" | "none";

/**
 * Ditampilkan saat user kembali dari DOKU Checkout (?status=return).
 * Redirect DOKU tidak membawa hasil pembayaran, jadi kita cek sendiri:
 * minta server sinkronkan status ke DOKU (/api/payments/sync), lalu baca membership.
 */
export function PaymentStatus() {
  const status = useSearchParams().get("status");
  const { user, loading: authLoading } = useAuth();
  const { refresh } = useMembership();
  const [phase, setPhase] = useState<Phase>("checking");

  useEffect(() => {
    if (status !== "return" || authLoading || !user) return;
    let cancelled = false;
    let tries = 0;
    const tick = async () => {
      if (cancelled) return;
      const res = await fetch("/api/payments/sync", { method: "POST" }).catch(() => null);
      const data = (await res?.json().catch(() => null)) as { status?: string } | null;
      if (await refresh()) return setPhase("active");
      if (data?.status === "none") return setPhase("none"); // tidak ada pembayaran pending
      if (data?.status === "FAILED" || data?.status === "EXPIRED") return setPhase("none");
      if (++tries >= 8) return setPhase("waiting");
      setTimeout(tick, 4000);
    };
    void tick();
    return () => {
      cancelled = true;
    };
  }, [status, authLoading, user, refresh]);

  if (status !== "return") return null;

  if (phase === "active") {
    return (
      <div role="status" className="flex gap-3 rounded-xl border border-up/30 bg-up-soft p-4 text-sm">
        <CircleCheck className="mt-0.5 size-5 shrink-0 text-up" />
        <p><span className="font-semibold">Terima kasih atas dukunganmu! 💚</span> Paket Pro sudah aktif di akunmu.</p>
      </div>
    );
  }
  if (phase === "checking") {
    return (
      <div role="status" className="flex gap-3 rounded-xl border bg-card p-4 text-sm">
        <Loader2 className="mt-0.5 size-5 shrink-0 animate-spin text-primary" />
        <p>Sedang mengecek status pembayaranmu…</p>
      </div>
    );
  }
  return (
    <div role="status" className="flex gap-3 rounded-xl border bg-card p-4 text-sm">
      <Info className="mt-0.5 size-5 shrink-0 text-primary" />
      <p>
        {phase === "waiting"
          ? "Pembayaran belum terkonfirmasi. Jika kamu sudah membayar (mis. lewat virtual account), status Pro akan aktif otomatis dalam beberapa menit — muat ulang halaman ini nanti."
          : "Belum ada pembayaran yang selesai. Tidak ada dana yang ditarik — kamu bisa mencoba lagi kapan saja."}
      </p>
    </div>
  );
}
