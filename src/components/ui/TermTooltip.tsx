"use client";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { CircleHelp } from "lucide-react";
import { GLOSSARY, type TermId } from "@/lib/glossary";
import { cn } from "@/lib/utils";

const PANEL_WIDTH = 288;
const GUTTER = 12;

/**
 * Penjelasan singkat istilah saham dari glosarium.
 * - Default: teks bergaris bawah titik-titik (pakai `children` untuk mengganti label).
 * - `icon`: hanya ikon tanda tanya, untuk header tabel atau label yang sudah tertulis.
 * Mouse: muncul saat hover. Sentuh/keyboard: klik untuk membuka, Esc atau klik di luar untuk menutup.
 * Panel dirender lewat portal dengan posisi fixed agar tidak terpotong container overflow (tabel).
 */
export function TermTooltip({
  term,
  children,
  icon = false,
  className,
}: {
  term: TermId;
  children?: ReactNode;
  icon?: boolean;
  className?: string;
}) {
  const t = GLOSSARY[term];
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [style, setStyle] = useState<CSSProperties>({ visibility: "hidden" });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<number | undefined>(undefined);
  const panelId = useId();

  const close = useCallback(() => {
    window.clearTimeout(closeTimer.current);
    setOpen(false);
    setPinned(false);
  }, []);

  const place = useCallback(() => {
    const el = triggerRef.current;
    const panel = panelRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const width = Math.min(PANEL_WIDTH, vw - GUTTER * 2);
    const left = Math.min(Math.max(GUTTER, r.left + r.width / 2 - width / 2), vw - GUTTER - width);
    const h = panel?.offsetHeight ?? 160;
    const below = vh - r.bottom >= h + 8 || r.top < h + 8;
    setStyle(below ? { left, width, top: r.bottom + 6 } : { left, width, bottom: vh - r.top + 6 });
  }, []);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close();
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, close, place]);

  useEffect(() => () => window.clearTimeout(closeTimer.current), []);

  const hoverOpen = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    window.clearTimeout(closeTimer.current);
    setOpen(true);
  };
  const hoverClose = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse" || pinned) return;
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setOpen(false), 150);
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-haspopup="dialog"
        aria-label={icon ? `Apa itu ${t.term}?` : undefined}
        onClick={(e) => {
          // Tooltip bisa berada di dalam baris/kartu yang bisa diklik
          e.stopPropagation();
          e.preventDefault();
          if (open && pinned) close();
          else {
            setOpen(true);
            setPinned(true);
          }
        }}
        onPointerEnter={hoverOpen}
        onPointerLeave={hoverClose}
        className={cn(
          "cursor-help rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
          icon
            ? "inline-flex size-5 shrink-0 items-center justify-center align-middle text-muted-foreground/70 hover:text-foreground"
            : "inline text-left underline decoration-muted-foreground/60 decoration-dotted underline-offset-[3px] hover:decoration-foreground",
          className,
        )}
      >
        {icon ? <CircleHelp className="size-3.5" aria-hidden /> : (children ?? t.term)}
      </button>
      {open &&
        createPortal(
          <div
            ref={panelRef}
            id={panelId}
            role="dialog"
            aria-label={t.term}
            style={{ position: "fixed", ...style }}
            onPointerEnter={hoverOpen}
            onPointerLeave={hoverClose}
            className="z-50 rounded-xl border bg-card p-3.5 text-left text-sm font-normal text-card-foreground normal-case shadow-lg"
          >
            <p className="font-semibold">
              {t.term}
              {t.aliases?.[0] && <span className="font-normal text-muted-foreground"> · {t.aliases[0]}</span>}
            </p>
            <p className="mt-1 leading-relaxed text-muted-foreground">{t.short}</p>
            <Link
              href={`/glosarium#${t.id}`}
              onClick={close}
              className="mt-2 inline-block text-xs font-medium text-primary hover:underline"
            >
              Selengkapnya di glosarium →
            </Link>
          </div>,
          document.body,
        )}
    </>
  );
}
