'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { ContentHeader } from '@/presentation/components/layout/ContentHeader';
import { GLOSSARY } from './glossaryData';

export function PanduanPage() {
  const [activeCategory, setActiveCategory] = useState<string>('umum');
  const [query, setQuery] = useState('');

  const filteredCategories = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return GLOSSARY.filter((c) => c.key === activeCategory);
    }
    return GLOSSARY.map((category) => ({
      ...category,
      terms: category.terms.filter(
        (t) => t.term.toLowerCase().includes(q) || t.definition.toLowerCase().includes(q)
      ),
    })).filter((category) => category.terms.length > 0);
  }, [activeCategory, query]);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <ContentHeader active="panduan" />

      <main className="mx-auto max-w-4xl space-y-6 px-4 py-8 pb-16 sm:px-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold uppercase tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-3xl">
            Panduan Istilah Saham
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            Penjelasan singkat dalam bahasa sederhana untuk istilah-istilah yang muncul di seluruh
            EzySaham AI — dari aturan bursa, indikator teknikal, rasio fundamental, hingga istilah
            skor yang EzySaham gunakan sendiri.
          </p>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" strokeWidth={2.5} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari istilah, mis. RSI, ARA, P/E..."
            className="w-full neo-border bg-white py-2.5 pl-9 pr-3 text-sm font-medium text-zinc-900 outline-none transition-shadow placeholder:text-zinc-400 focus:shadow-(--neo-shadow-sm) dark:bg-zinc-900 dark:text-zinc-100"
          />
        </div>

        {!query.trim() && (
          <div className="flex flex-wrap gap-2">
            {GLOSSARY.map((category) => (
              <button
                key={category.key}
                type="button"
                onClick={() => setActiveCategory(category.key)}
                className={
                  activeCategory === category.key
                    ? 'neo-border bg-(--neo-accent) px-3.5 py-1.5 text-xs font-bold uppercase tracking-wide text-black'
                    : 'border-2 border-(--neo-line) bg-white px-3.5 py-1.5 text-xs font-bold uppercase tracking-wide text-zinc-600 transition-colors hover:bg-zinc-100 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800'
                }
              >
                {category.label}
              </button>
            ))}
          </div>
        )}

        <div className="space-y-6">
          {filteredCategories.length === 0 && (
            <div className="neo-border neo-shadow bg-white p-6 text-center text-sm font-semibold text-zinc-400 dark:bg-zinc-900">
              Tidak ada istilah yang cocok dengan pencarian &quot;{query}&quot;.
            </div>
          )}

          {filteredCategories.map((category) => (
            <div key={category.key} className="space-y-3">
              {query.trim() && (
                <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  {category.label}
                </h2>
              )}
              <div className="space-y-3">
                {category.terms.map((item) => (
                  <div key={item.term} className="neo-border neo-shadow-sm bg-white p-4 dark:bg-zinc-900">
                    <h3 className="font-bold text-zinc-900 dark:text-zinc-50">{item.term}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                      {item.definition}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3 neo-border neo-shadow bg-white p-5 dark:bg-zinc-900">
          <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            Sudah paham istilahnya? Lanjut coba langsung di Screener.
          </p>
          <Link
            href="/screener"
            className="neo-press ml-auto neo-border bg-(--neo-accent) px-4 py-2 text-sm font-bold uppercase tracking-wide text-black neo-shadow-sm"
          >
            Buka Screener
          </Link>
        </div>
      </main>
    </div>
  );
}
