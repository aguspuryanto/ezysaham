"use client";
import { useEffect, useState } from "react";
import { Check, Copy, Share2 } from "lucide-react";
import { buttonClass } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Salin ke clipboard; fallback textarea untuk browser/koneksi non-HTTPS tanpa Clipboard API. */
async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }
}

/**
 * Tombol salin teks & bagikan ke media sosial.
 * - text: isi lengkap (untuk salin, WhatsApp, Telegram, share bawaan HP)
 * - teaser: kalimat pendek untuk X (batas 280 karakter)
 * - path: halaman yang dibagikan (origin diambil dari browser)
 */
export function ShareActions({ title, text, teaser, path }: { title: string; text: string; teaser: string; path: string }) {
  const [url, setUrl] = useState("");
  const [canShare, setCanShare] = useState(false);
  const [copied, setCopied] = useState(false);

  // Diisi setelah mount agar tidak terjadi hydration mismatch.
  useEffect(() => {
    setUrl(`${window.location.origin}${path}`);
    setCanShare(typeof navigator.share === "function");
  }, [path]);

  const full = url ? `${text}\n\n${url}` : text;
  const enc = encodeURIComponent;
  const links = url
    ? [
        { label: "WhatsApp", href: `https://wa.me/?text=${enc(full)}` },
        { label: "Telegram", href: `https://t.me/share/url?url=${enc(url)}&text=${enc(text)}` },
        { label: "X", href: `https://x.com/intent/post?text=${enc(teaser)}&url=${enc(url)}` },
        { label: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}` },
      ]
    : [];

  const onCopy = async () => {
    if (await copyText(full)) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }
  };

  const onShare = async () => {
    try {
      await navigator.share({ title, text, url });
    } catch {
      // dibatalkan pengguna — abaikan
    }
  };

  const btn = cn(buttonClass("outline", "sm"), "h-7 px-2.5");

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button type="button" onClick={onCopy} className={btn} aria-live="polite">
        {copied ? <Check className="text-up" /> : <Copy />}
        {copied ? "Tersalin" : "Salin teks"}
      </button>
      {canShare && (
        <button type="button" onClick={onShare} className={btn}>
          <Share2 /> Bagikan
        </button>
      )}
      {links.map((l) => (
        <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer" className={btn} aria-label={`Bagikan ke ${l.label}`}>
          {l.label}
        </a>
      ))}
    </div>
  );
}
