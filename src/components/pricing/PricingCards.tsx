"use client";
import { useState } from "react";
import Link from "next/link";
import { BadgeCheck, Check, Clock, Heart, Loader2 } from "lucide-react";
import { Button, buttonClass } from "@/components/ui/button";
import { useAuth } from "@/components/auth/AuthProvider";
import { useMembership } from "@/hooks/useMembership";
import { PRO_FEATURES, PRO_PRICE, STARTER_FEATURES, yearlySavingPct, type PlanFeature } from "@/lib/plans";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";

type Billing = "monthly" | "yearly";

export function PricingCards({ paymentsEnabled }: { paymentsEnabled: boolean }) {
  const [billing, setBilling] = useState<Billing>("yearly");
  const { user, configured } = useAuth();
  const perMonth = billing === "monthly" ? PRO_PRICE.monthly : Math.round(PRO_PRICE.yearly / 12);

  return (
    <section className="space-y-6">
      <div className="flex justify-center">
        <div className="inline-flex rounded-xl border bg-muted/60 p-1" role="group" aria-label="Periode pembayaran">
          {(["monthly", "yearly"] as const).map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => setBilling(b)}
              aria-pressed={billing === b}
              className={cn(
                "inline-flex items-center gap-2 rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors",
                billing === b ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {b === "monthly" ? "Bulanan" : "Tahunan"}
              {b === "yearly" && (
                <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-bold text-primary">
                  Hemat {yearlySavingPct}%
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        {/* Starter */}
        <div className="flex flex-col rounded-2xl border bg-card p-6">
          <h2 className="text-lg font-bold">Starter</h2>
          <p className="mt-1 text-sm text-muted-foreground">Semua yang kamu butuhkan untuk mulai berinvestasi dengan lebih paham.</p>
          <p className="mt-5 flex items-baseline gap-1">
            <span className="text-sm font-semibold text-muted-foreground">Rp</span>
            <span className="text-4xl font-bold tracking-tight">0</span>
            <span className="text-sm text-muted-foreground">/selamanya</span>
          </p>
          <p className="mt-1 h-5 text-xs text-muted-foreground">Tanpa kartu kredit, tanpa batas waktu.</p>
          {configured && !user ? (
            <Link href="/login" className={cn(buttonClass("outline"), "mt-5 w-full")}>Daftar gratis</Link>
          ) : (
            <Link href="/screener" className={cn(buttonClass("outline"), "mt-5 w-full")}>Mulai pakai</Link>
          )}
          <FeatureList features={STARTER_FEATURES} />
        </div>

        {/* Pro */}
        <div className="relative flex flex-col rounded-2xl border border-primary/40 bg-gradient-to-b from-primary/[0.06] to-card p-6 shadow-sm">
          <span className="absolute -top-3 left-6 inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-[11px] font-bold tracking-wide text-primary-foreground uppercase">
            <Heart className="size-3 fill-current" /> Pendukung
          </span>
          <h2 className="text-lg font-bold">Pro</h2>
          <p className="mt-1 text-sm text-muted-foreground">Untuk kamu yang merasa terbantu dan ingin EzySaham terus berkembang.</p>
          <p className="mt-5 flex items-baseline gap-1">
            <span className="text-sm font-semibold text-muted-foreground">Rp</span>
            <span className="text-4xl font-bold tracking-tight text-primary tabular-nums">{formatPrice(perMonth)}</span>
            <span className="text-sm text-muted-foreground">/bulan</span>
          </p>
          <p className="mt-1 h-5 text-xs text-muted-foreground">
            {billing === "yearly" ? (
              <>
                Dibayar Rp{formatPrice(PRO_PRICE.yearly)} per tahun ·{" "}
                <span className="line-through">Rp{formatPrice(PRO_PRICE.monthly * 12)}</span>
              </>
            ) : (
              "Dibayar per bulan, tanpa perpanjangan otomatis."
            )}
          </p>
          <ProAction billing={billing} paymentsEnabled={paymentsEnabled} />
          <FeatureList features={PRO_FEATURES} label="Semua di Starter, plus" />
        </div>
      </div>
    </section>
  );
}

/** Tombol bayar Pro + status Pro aktif. */
function ProAction({ billing, paymentsEnabled }: { billing: Billing; paymentsEnabled: boolean }) {
  const { user, configured, loading: authLoading } = useAuth();
  const { isPro, expiresAt } = useMembership();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkout = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period: billing }),
      });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error ?? "Gagal membuat tagihan.");
      window.location.href = data.url; // halaman pembayaran Xendit
    } catch (e) {
      setError(e instanceof Error ? e.message : "Terjadi kesalahan.");
      setBusy(false);
    }
  };

  const until = expiresAt ? new Date(expiresAt).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : "";

  if (!paymentsEnabled || !configured) {
    return (
      <>
        <Button className="mt-5 w-full" disabled title="Pembayaran segera tersedia">
          <Heart /> Dukung dengan Pro
        </Button>
        <p className="mt-2 text-center text-xs text-muted-foreground">Pembayaran segera tersedia.</p>
      </>
    );
  }

  if (!authLoading && !user) {
    return (
      <>
        <Link href="/login" className={cn(buttonClass("default"), "mt-5 w-full")}>
          <Heart /> Masuk untuk mendukung
        </Link>
        <p className="mt-2 text-center text-xs text-muted-foreground">Pro terhubung ke akun emailmu.</p>
      </>
    );
  }

  return (
    <>
      {isPro && (
        <p className="mt-5 flex items-center justify-center gap-1.5 rounded-lg bg-up-soft px-3 py-2 text-sm font-medium text-up">
          <BadgeCheck className="size-4" /> Pro aktif sampai {until}
        </p>
      )}
      <Button className={cn("w-full", isPro ? "mt-3" : "mt-5")} variant={isPro ? "outline" : "default"} onClick={checkout} disabled={busy || authLoading}>
        {busy ? <Loader2 className="animate-spin" /> : <Heart />}
        {busy ? "Membuka pembayaran…" : isPro ? `Perpanjang ${billing === "yearly" ? "1 tahun" : "1 bulan"}` : "Dukung dengan Pro"}
      </Button>
      {error ? (
        <p role="alert" className="mt-2 text-center text-xs text-down">{error}</p>
      ) : (
        <p className="mt-2 text-center text-xs text-muted-foreground">QRIS · Virtual Account · E-wallet · Kartu — via Xendit</p>
      )}
    </>
  );
}

function FeatureList({ features, label = "Yang kamu dapat" }: { features: PlanFeature[]; label?: string }) {
  return (
    <div className="mt-6 border-t pt-5">
      <p className="mb-3 text-[11px] font-bold tracking-wider text-muted-foreground uppercase">{label}</p>
      <ul className="space-y-2.5">
        {features.map((f) => (
          <li key={f.text} className="flex gap-2.5 text-sm">
            {f.soon ? (
              <Clock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            ) : (
              <Check className="mt-0.5 size-4 shrink-0 text-primary" />
            )}
            <span className={cn(f.soon && "text-muted-foreground")}>
              {f.text}
              {f.soon && <span className="ml-1.5 rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold">Segera</span>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
