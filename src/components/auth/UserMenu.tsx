"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LogIn, LogOut, UserRound } from "lucide-react";
import { Button, buttonClass } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/misc";
import { useAuth } from "./AuthProvider";

export function UserMenu() {
  const { user, loading, configured } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  if (!configured) return null;
  if (loading) return <Skeleton className="size-9 rounded-full" />;

  if (!user) {
    return (
      <Link href="/login" className={buttonClass("outline", "sm")}>
        <LogIn /> <span className="hidden sm:inline">Masuk / Daftar</span>
      </Link>
    );
  }

  const email = user.email ?? "";
  return (
    <div ref={ref} className="relative">
      <Button
        variant="ghost"
        size="icon"
        aria-label="Menu akun"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="rounded-full"
      >
        <span className="grid size-8 place-items-center rounded-full bg-primary/15 text-sm font-semibold text-primary uppercase">
          {email.charAt(0) || <UserRound />}
        </span>
      </Button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-64 rounded-xl border bg-card p-2 shadow-lg">
          <div className="px-2 py-1.5">
            <p className="text-xs text-muted-foreground">Masuk sebagai</p>
            <p className="truncate text-sm font-medium">{email}</p>
          </div>
          <Link href="/portfolio" onClick={() => setOpen(false)} className="block rounded-lg px-2 py-2 text-sm hover:bg-accent">
            Portofolio saya
          </Link>
          <form action="/auth/signout" method="post">
            <button type="submit" className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-down hover:bg-accent">
              <LogOut className="size-4" /> Keluar
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
