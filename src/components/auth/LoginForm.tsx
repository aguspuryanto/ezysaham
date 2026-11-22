"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ChartCandlestick, MailCheck, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/misc";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { useAuth } from "./AuthProvider";

const ERRORS: Record<string, string> = {
  expired: "Link login sudah kedaluwarsa atau sudah pernah dipakai. Silakan minta link baru.",
  invalid: "Link login tidak valid. Pastikan link dibuka di browser yang sama saat meminta link, lalu coba lagi.",
  not_configured: "Login belum dikonfigurasi di server.",
};

const COOLDOWN = 60;

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { user, configured } = useAuth();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(() => {
    const e = params.get("error");
    return e ? (ERRORS[e] ?? ERRORS.invalid) : null;
  });
  const [cooldown, setCooldown] = useState(0);

  // Sudah login → langsung ke home
  useEffect(() => {
    if (user) router.replace("/");
  }, [user, router]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const send = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const supabase = getSupabaseBrowser();
    if (!supabase) return;
    const value = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) {
      setError("Format email tidak valid.");
      return;
    }
    setStatus("sending");
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: value,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        shouldCreateUser: true,
      },
    });
    if (error) {
      setStatus("idle");
      setError(
        error.status === 429
          ? "Terlalu banyak permintaan. Tunggu beberapa saat sebelum meminta link lagi."
          : `Gagal mengirim link: ${error.message}`,
      );
      return;
    }
    setStatus("sent");
    setCooldown(COOLDOWN);
  };

  return (
    <div className="w-full max-w-sm space-y-6">
      <Link href="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Kembali
      </Link>

      <div className="flex flex-col items-center gap-3 text-center">
        <span className="grid size-12 place-items-center rounded-xl bg-primary text-primary-foreground">
          <ChartCandlestick className="size-7" />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Masuk atau Daftar</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tanpa password. Cukup masukkan email — kami kirim link untuk masuk. Belum punya akun? Akun dibuat otomatis saat kamu
            membuka link pertama kali. Portofolio tersimpan di akun dan bisa diakses dari perangkat mana pun.
          </p>
        </div>
      </div>

      <Card className="p-5">
        {!configured ? (
          <div className="flex gap-3 text-sm">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warn" />
            <p className="text-muted-foreground">
              Login belum aktif: isi <code className="font-mono text-xs">NEXT_PUBLIC_SUPABASE_URL</code> dan{" "}
              <code className="font-mono text-xs">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> di <code className="font-mono text-xs">.env.local</code>, lalu restart server.
            </p>
          </div>
        ) : status === "sent" ? (
          <div className="space-y-4 text-center">
            <span className="mx-auto grid size-12 place-items-center rounded-full bg-up-soft text-up">
              <MailCheck className="size-6" />
            </span>
            <div>
              <p className="font-semibold">Cek email kamu</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Link login sudah dikirim ke <span className="font-medium text-foreground">{email.trim()}</span>. Klik link tersebut untuk masuk. Cek juga folder spam.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Button variant="outline" onClick={() => send()} disabled={cooldown > 0}>
                {cooldown > 0 ? `Kirim ulang dalam ${cooldown} dtk` : "Kirim ulang link"}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { setStatus("idle"); setError(null); }}>
                Ganti email
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={send} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoFocus
                placeholder="nama@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={status === "sending" || !email.trim()}>
              {status === "sending" ? "Mengirim…" : "Kirim link masuk"}
            </Button>
          </form>
        )}

        {error && (
          <p role="alert" className="mt-4 flex gap-2 rounded-lg bg-down-soft p-3 text-sm text-down">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" /> {error}
          </p>
        )}
      </Card>

      <p className="text-center text-xs text-muted-foreground">
        Tanpa login pun kamu tetap bisa memakai semua fitur. Portofolio akan tersimpan di browser ini saja.
      </p>
    </div>
  );
}
