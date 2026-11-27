"use client";
import { useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { glossaryByCategory, glossaryRelated, isTermId, type GlossaryTerm, type TermId } from "@/lib/glossary";
import { Input } from "@/components/ui/misc";
import { cn } from "@/lib/utils";

const SECTIONS = glossaryByCategory();

function matches(t: GlossaryTerm, q: string) {
  const hay = [t.term, ...(t.aliases ?? []), t.short].join(" ").toLowerCase();
  return hay.includes(q);
}

export function GlossaryBrowser() {
  const [q, setQ] = useState("");
  /** id dari hash URL (istilah atau kategori) yang perlu di-scroll */
  const [hashId, setHashId] = useState<string | null>(null);
  const query = q.trim().toLowerCase();

  const sections = useMemo(
    () => (query ? SECTIONS.map((s) => ({ ...s, terms: s.terms.filter((t) => matches(t, query)) })).filter((s) => s.terms.length) : SECTIONS),
    [query],
  );
  const count = sections.reduce((n, s) => n + s.terms.length, 0);

  // Datang dari tooltip (/glosarium#per) atau link "Terkait". Halaman di-stream (loading.tsx), jadi scroll
  // bawaan browser ke anchor sering gagal untuk istilah di bawah. Scroll ulang setelah hydrate, dan kosongkan
  // pencarian agar istilah tujuan pasti tampil.
  useEffect(() => {
    const sync = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (!id) return;
      setQ("");
      setHashId(id);
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  useEffect(() => {
    if (hashId) document.getElementById(hashId)?.scrollIntoView({ block: "start" });
  }, [hashId]);

  const active: TermId | null = hashId && isTermId(hashId) ? hashId : null;

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari istilah, mis. PER, dividen, gorengan…"
            className="pr-9 pl-9"
            aria-label="Cari istilah"
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ("")}
              aria-label="Hapus pencarian"
              className="absolute top-1/2 right-2 flex size-6 -translate-y-1/2 items-center justify-center rounded text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        {!query && (
          <nav aria-label="Kategori istilah" className="-mx-4 overflow-x-auto px-4 scrollbar-none sm:mx-0 sm:px-0">
            <div className="flex w-max gap-2">
              {SECTIONS.map((s) => (
                <a
                  key={s.id}
                  href={`#kategori-${s.id}`}
                  className="rounded-full border bg-card px-3.5 py-1.5 text-sm font-medium whitespace-nowrap text-muted-foreground hover:text-foreground"
                >
                  {s.label}
                </a>
              ))}
            </div>
          </nav>
        )}

        {query && (
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {count ? `${count} istilah cocok` : "Tidak ada istilah yang cocok."}
          </p>
        )}
      </div>

      {sections.map((s) => (
        <section key={s.id} aria-labelledby={`kategori-${s.id}`} className="space-y-3">
          <div>
            <h2 id={`kategori-${s.id}`} className="scroll-mt-20 text-lg font-semibold">{s.label}</h2>
            <p className="text-sm text-muted-foreground">{s.description}</p>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {s.terms.map((t) => (
              <TermEntry key={t.id} t={t} active={active === t.id} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function TermEntry({ t, active }: { t: GlossaryTerm; active: boolean }) {
  const related = glossaryRelated(t);
  return (
    <article
      id={t.id}
      className={cn(
        "scroll-mt-20 rounded-xl border bg-card p-4 transition-shadow",
        active && "border-primary ring-2 ring-primary/30",
      )}
    >
      <h3 className="font-semibold">
        <a href={`#${t.id}`} className="hover:text-primary">{t.term}</a>
      </h3>
      {t.aliases && <p className="text-xs text-muted-foreground">{t.aliases.join(" · ")}</p>}
      <p className="mt-2 text-sm font-medium">{t.short}</p>
      <div className="mt-2 space-y-2 text-sm leading-relaxed text-muted-foreground">
        {t.body.map((p) => (
          <p key={p}>{p}</p>
        ))}
      </div>
      {t.example && (
        <p className="mt-3 rounded-lg bg-muted/60 px-3 py-2 text-sm">
          <span className="font-medium">Contoh: </span>
          {t.example}
        </p>
      )}
      {related.length > 0 && (
        <p className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <span>Terkait:</span>
          {related.map((r) => (
            <a key={r.id} href={`#${r.id}`} className="rounded-md border px-1.5 py-0.5 font-medium text-foreground hover:border-primary hover:text-primary">
              {r.term}
            </a>
          ))}
        </p>
      )}
    </article>
  );
}
