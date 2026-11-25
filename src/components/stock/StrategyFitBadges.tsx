"use client";
import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/misc";
import { FIT_LABEL, type FitStatus, type StrategyFit } from "@/lib/strategyFit";

const VARIANT: Record<FitStatus, "up" | "warn" | "down" | "default"> = {
  fit: "up",
  caution: "warn",
  avoid: "down",
  unknown: "default",
};

/**
 * Badge kecocokan saham untuk Trading / Swing / Investasi.
 * Hover (mouse) atau ketuk (sentuh) untuk melihat alasannya.
 */
export function StrategyFitBadges({ fits }: { fits: StrategyFit[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(null);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    // Popover ditambatkan ke baris badge (bukan ke tiap badge) agar tidak keluar layar di kolom sempit.
    <div ref={ref} className="relative flex flex-wrap items-center gap-1.5">
      {fits.map((f) => (
        <div
          key={f.key}
          onPointerEnter={(e) => e.pointerType === "mouse" && setOpen(f.key)}
          onPointerLeave={(e) => e.pointerType === "mouse" && setOpen((o) => (o === f.key ? null : o))}
        >
          <button
            type="button"
            aria-expanded={open === f.key}
            aria-label={`${f.label} (${f.horizon}): ${FIT_LABEL[f.status]}`}
            onClick={() => setOpen((o) => (o === f.key ? null : f.key))}
            className="rounded-md focus-visible:outline-2"
          >
            <Badge variant={VARIANT[f.status]} className="cursor-help">
              {f.label}: {FIT_LABEL[f.status]}
            </Badge>
          </button>
          {open === f.key && (
            <div
              role="tooltip"
              className="absolute inset-x-0 top-full z-30 mt-1.5 rounded-lg border bg-card p-3 text-xs text-card-foreground shadow-lg"
            >
              <p className="font-semibold">
                {f.label} <span className="font-normal text-muted-foreground">· {f.horizon}</span>
              </p>
              <ul className="mt-1.5 list-disc space-y-1 pl-4 text-muted-foreground">
                {f.reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
              <p className="mt-2 text-[11px] text-muted-foreground/80">Penyaringan otomatis, bukan rekomendasi beli/jual.</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
