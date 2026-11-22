"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CircleCheck, Loader2, TriangleAlert } from "lucide-react";
import { useMembership } from "@/hooks/useMembership";

/**
 * Pesan setelah kembali dari halaman Xendit (?status=success|failed).
 * Webhook bisa datang beberapa detik setelah redirect, jadi status Pro dicek ulang berkala.
 */
export function PaymentStatus() {
  const status = useSearchParams().get("status");
  const { isPro, refresh } = useMembership();
  const [confirmed, setConfirmed] = useState(false);
  const [gaveUp, setGaveUp] = useState(false);

  useEffect(() => {
    if (status !== "success") return;
    let tries = 0;
    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      if (await refresh()) return setConfirmed(true);
      if (++tries >= 10) return setGaveUp(true);
      setTimeout(tick, 3000);
    };
    void tick();
    return () => {
      cancelled = true;
    };
  }, [status, refresh]);

  if (status === "failed") {
    return (
      <div role="alert" className="flex gap-3 rounded-xl border border-down/30 bg-down-soft p-4 text-sm">
        <TriangleAlert className="mt-0.5 size-5 shrink-0 text-down" />
        <p>Pembayaran dibatalkan atau gagal. Tidak ada dana yang ditarik — kamu bisa mencoba lagi kapan saja.</p>
      </div>
    );
  }
  if (status !== "success") return null;

  return (
    <div role="status" className="flex gap-3 rounded-xl border border-up/30 bg-up-soft p-4 text-sm">
      {confirmed || isPro ? (
        <>
          <CircleCheck className="mt-0.5 size-5 shrink-0 text-up" />
          <p><span className="font-semibold">Terima kasih atas dukunganmu! 💚</span> Paket Pro sudah aktif di akunmu.</p>
        </>
      ) : gaveUp ? (
        <>
          <CircleCheck className="mt-0.5 size-5 shrink-0 text-up" />
          <p>Pembayaran diterima dan sedang dikonfirmasi. Status Pro akan aktif dalam beberapa menit — muat ulang halaman ini nanti.</p>
        </>
      ) : (
        <>
          <Loader2 className="mt-0.5 size-5 shrink-0 animate-spin text-up" />
          <p>Terima kasih! Sedang mengonfirmasi pembayaranmu…</p>
        </>
      )}
    </div>
  );
}
