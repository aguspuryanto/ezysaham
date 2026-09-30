'use client';

/**
 * PanduanPage.tsx
 *
 * /panduan — glossary of stock terms, sharing the Screener's header, sidebar
 * nav and `.sv-theme` tokens. Content lives in glossaryData.ts; the header
 * search filters across every category.
 */

import { BookOpen, Building2, ChevronRight, Home, Landmark, LineChart, LucideIcon, PieChart, Radar, ScanSearch, SearchX, Sparkles, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Fragment, ReactNode, useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/format';
import { SITE_NAME } from '@/lib/site';
import { useMarketSeries } from '../screener/components/MarketSummary';
import { ScreenerHeader } from '../screener/components/ScreenerHeader';
import { ScreenerNav } from '../screener/components/ScreenerNav';
import { ScreenerTabItem, ScreenerTabs } from '../screener/components/ScreenerTabs';
import { Badge, Card, PanelTitle } from '../screener/detail/components/ui';
import { screenerInter } from '../screener/fonts';
import { useWatchlist } from '../screener/hooks/useWatchlist';
import { GLOSSARY, GlossaryTerm } from './glossaryData';

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  umum: Landmark,
  teknikal: LineChart,
  fundamental: Building2,
  skor: Sparkles,
};

const CATEGORY_ITEMS: ScreenerTabItem[] = GLOSSARY.map((c) => ({ id: c.key, label: c.label, icon: CATEGORY_ICONS[c.key] ?? BookOpen }));
const TOTAL_TERMS = GLOSSARY.reduce((n, c) => n + c.terms.length, 0);

const NEXT_STEPS: Array<{ href: string; label: string; hint: string; icon: LucideIcon }> = [
  { href: '/screener', label: 'Screener Saham', hint: 'Terapkan istilahnya untuk menyaring saham', icon: ScanSearch },
  { href: '/signal', label: 'SARA AI Signals', hint: 'Lihat skor & alasan sinyal harian', icon: Radar },
  { href: '/sektor', label: 'Sektor', hint: 'Bandingkan performa antar sektor', icon: PieChart },
];

/** Wraps case-insensitive matches of `q` in <mark>. */
function highlight(text: string, q: string): ReactNode {
  if (!q) return text;
  const lower = text.toLowerCase();
  const parts: ReactNode[] = [];
  let from = 0;
  for (let i = lower.indexOf(q, from); i !== -1; i = lower.indexOf(q, from)) {
    if (i > from) parts.push(text.slice(from, i));
    parts.push(<mark key={i} className="rounded-sm bg-amber-200/70 px-0.5 text-inherit dark:bg-amber-400/30">{text.slice(i, i + q.length)}</mark>);
    from = i + q.length;
  }
  parts.push(text.slice(from));
  return parts.map((p, i) => <Fragment key={i}>{p}</Fragment>);
}

function TermCard({ item, q, category }: { item: GlossaryTerm; q: string; category?: string }) {
  return (
    <Card as="div" className="flex flex-col gap-2 p-4">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-[15px] font-semibold text-(--sv-text)">{highlight(item.term, q)}</h3>
        {category && <Badge tone="info" className="shrink-0">{category}</Badge>}
      </div>
      <p className="text-sm leading-relaxed text-(--sv-muted)">{highlight(item.definition, q)}</p>
    </Card>
  );
}

export function PanduanPage() {
  const router = useRouter();
  const market = useMarketSeries();
  const watchlist = useWatchlist();
  const [activeCategory, setActiveCategory] = useState(GLOSSARY[0].key);
  const [query, setQuery] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Mobile/tablet drawer: lock body scroll and close on Escape (same behaviour as ScreenerPage).
  useEffect(() => {
    if (!drawerOpen) return;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') setDrawerOpen(false); };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [drawerOpen]);

  const q = query.trim().toLowerCase();
  const searchResults = useMemo(() => {
    if (!q) return [];
    return GLOSSARY.map((c) => ({
      ...c,
      terms: c.terms.filter((t) => t.term.toLowerCase().includes(q) || t.definition.toLowerCase().includes(q)),
    })).filter((c) => c.terms.length > 0);
  }, [q]);
  const matchCount = searchResults.reduce((n, c) => n + c.terms.length, 0);
  const category = GLOSSARY.find((c) => c.key === activeCategory) ?? GLOSSARY[0];

  const selectCategory = (key: string) => {
    setActiveCategory(key);
    setQuery('');
  };

  return (
    <div className={cn('sv-theme flex min-h-screen w-full flex-col', screenerInter.variable)}>
      <ScreenerHeader
        query={query}
        onQueryChange={setQuery}
        lastUpdatedAt={null}
        ihsg={market.ihsg}
        onOpenDrawer={() => setDrawerOpen(true)}
      />

      <div className="flex flex-1">
        {drawerOpen && <div className="fixed inset-0 z-40 bg-slate-900/40 xl:hidden" onClick={() => setDrawerOpen(false)} aria-hidden="true" />}
        <aside
          aria-label="Menu utama"
          className={cn(
            'fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col gap-6 overflow-y-auto border-r border-(--sv-border) bg-(--sv-surface) p-4 transition-transform duration-300 ease-out',
            drawerOpen ? 'translate-x-0 shadow-xl' : '-translate-x-full',
            'xl:sticky xl:top-16 xl:z-auto xl:h-[calc(100vh-4rem)] xl:w-64 xl:max-w-none xl:shrink-0 xl:translate-x-0 xl:shadow-none',
          )}
        >
          <div className="flex items-center justify-between xl:hidden">
            <span className="text-sm font-semibold text-(--sv-text)">Menu</span>
            <button type="button" onClick={() => setDrawerOpen(false)} aria-label="Tutup" className="flex size-8 items-center justify-center rounded-lg border border-(--sv-border) text-(--sv-text)">
              <X className="size-4" strokeWidth={2} />
            </button>
          </div>
          <ScreenerNav watchlistOnly={false} watchlistCount={watchlist.tickers.length} onToggleWatchlist={() => router.push('/screener')} />
          <p className="mt-auto text-[11px] text-(--sv-muted)">© {new Date().getFullYear()} {SITE_NAME} · Data EOD, bukan prediksi harga.</p>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col gap-5 px-4 py-5 pb-28 sm:px-6 xl:pb-8">
          <nav aria-label="Breadcrumb" className="text-sm">
            <ol className="flex items-center gap-1.5 text-(--sv-muted)">
              <li><Link href="/" aria-label="Beranda" className="flex items-center hover:text-(--sv-text)"><Home className="size-4" strokeWidth={2} /></Link></li>
              <ChevronRight className="size-3.5" aria-hidden="true" />
              <li aria-current="page" className="font-medium text-(--sv-text)">Edukasi</li>
            </ol>
          </nav>

          <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
            <span className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-(--sv-primary) text-(--sv-primary-fg)">
              <BookOpen className="size-7" strokeWidth={2} />
            </span>
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-bold text-(--sv-text) sm:text-3xl">Panduan Istilah Saham</h1>
              <p className="mt-1 max-w-3xl text-sm leading-relaxed text-(--sv-muted)">
                Penjelasan singkat dalam bahasa sederhana untuk istilah yang muncul di seluruh {SITE_NAME} — dari aturan bursa,
                indikator teknikal, rasio fundamental, hingga istilah skor yang {SITE_NAME} gunakan sendiri.
              </p>
            </div>
            <dl className="flex shrink-0 gap-6 text-sm sm:flex-col sm:gap-1 sm:text-right">
              <div><dt className="text-xs text-(--sv-muted)">Istilah</dt><dd className="text-lg font-bold tabular-nums text-(--sv-text)">{TOTAL_TERMS}</dd></div>
              <div><dt className="text-xs text-(--sv-muted)">Kategori</dt><dd className="text-lg font-bold tabular-nums text-(--sv-text)">{GLOSSARY.length}</dd></div>
            </dl>
          </Card>

          <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] 2xl:grid-cols-[minmax(0,1fr)_22rem]">
            <main className="flex min-w-0 flex-col gap-4">
              {q ? (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <p className="text-(--sv-muted)">
                      <b className="tabular-nums text-(--sv-text)">{matchCount}</b> istilah cocok dengan &ldquo;<span className="text-(--sv-text)">{query.trim()}</span>&rdquo;
                    </p>
                    <button type="button" onClick={() => setQuery('')} className="font-medium text-(--sv-primary) hover:underline">Hapus pencarian</button>
                  </div>
                  {searchResults.length === 0 ? (
                    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-(--sv-border) bg-(--sv-surface) px-6 py-14 text-center">
                      <span className="flex size-12 items-center justify-center rounded-full bg-(--sv-primary-soft) text-(--sv-primary)">
                        <SearchX className="size-6" strokeWidth={2} />
                      </span>
                      <p className="text-base font-semibold text-(--sv-text)">Istilah tidak ditemukan</p>
                      <p className="max-w-sm text-sm text-(--sv-muted)">Coba kata kunci lain, mis. RSI, ARA, P/E, atau pilih kategori di bawah.</p>
                      <button type="button" onClick={() => setQuery('')} className="mt-1 rounded-lg border border-(--sv-border) px-3.5 py-2 text-sm font-medium text-(--sv-text) hover:bg-(--sv-bg)">
                        Lihat semua kategori
                      </button>
                    </div>
                  ) : (
                    searchResults.map((c) => (
                      <section key={c.key} aria-label={c.label} className="flex flex-col gap-3">
                        <h2 className="text-sm font-semibold text-(--sv-muted)">{c.label} <span className="font-normal">({c.terms.length})</span></h2>
                        <div className="grid gap-3 md:grid-cols-2">
                          {c.terms.map((t) => <TermCard key={t.term} item={t} q={q} />)}
                        </div>
                      </section>
                    ))
                  )}
                </>
              ) : (
                <>
                  <ScreenerTabs items={CATEGORY_ITEMS} selected={category.key} onSelect={selectCategory} count={category.terms.length} />
                  <section id={`panel-${category.key}`} aria-label={category.label} className="grid gap-3 md:grid-cols-2">
                    {category.terms.map((t) => <TermCard key={t.term} item={t} q="" />)}
                  </section>
                </>
              )}
            </main>

            <aside aria-label="Navigasi panduan" className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-20 lg:self-start">
              <Card>
                <PanelTitle icon={BookOpen}>Kategori</PanelTitle>
                <ul className="flex flex-col p-2">
                  {GLOSSARY.map((c) => {
                    const Icon = CATEGORY_ICONS[c.key] ?? BookOpen;
                    const active = !q && c.key === category.key;
                    return (
                      <li key={c.key}>
                        <button
                          type="button"
                          onClick={() => selectCategory(c.key)}
                          aria-current={active ? 'true' : undefined}
                          className={cn(
                            'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors',
                            active ? 'bg-(--sv-primary-soft) font-semibold text-(--sv-primary)' : 'text-(--sv-text) hover:bg-(--sv-bg)',
                          )}
                        >
                          <Icon className="size-4 shrink-0" strokeWidth={2} />
                          <span className="flex-1">{c.label}</span>
                          <span className="tabular-nums text-xs text-(--sv-muted)">{c.terms.length}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </Card>

              <Card>
                <PanelTitle icon={Sparkles}>Langsung Praktik</PanelTitle>
                <ul className="divide-y divide-(--sv-border)">
                  {NEXT_STEPS.map(({ href, label, hint, icon: Icon }) => (
                    <li key={href}>
                      <Link href={href} className="flex items-center gap-3 px-4 py-3 hover:bg-(--sv-bg)">
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-(--sv-primary-soft) text-(--sv-primary)">
                          <Icon className="size-4" strokeWidth={2} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold text-(--sv-text)">{label}</span>
                          <span className="block text-xs text-(--sv-muted)">{hint}</span>
                        </span>
                        <ChevronRight className="size-4 text-(--sv-muted)" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}
