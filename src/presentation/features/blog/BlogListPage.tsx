'use client';

/**
 * BlogListPage.tsx
 *
 * /blog — article index in the Screener's `.sv-theme` shell. Posts are read
 * from content/blog on the server (getAllPosts) and passed in, newest first;
 * the header search filters by title, description and ticker.
 */

import { ArrowRight, BookOpen, CalendarDays, ChevronRight, FileText, Home, LayoutGrid, LineChart, Newspaper, Radar, ScanSearch, SearchX, UserRound } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { BlogPostMeta } from '@/lib/blog';
import { cn } from '@/lib/format';
import { AppShell } from '../screener/components/AppShell';
import { ScreenerPagination } from '../screener/components/ScreenerTable';
import { ScreenerTabItem, ScreenerTabs } from '../screener/components/ScreenerTabs';
import { Badge, Card, PanelTitle } from '../screener/detail/components/ui';

const PAGE_SIZE = 12;

type Kind = 'all' | 'emiten' | 'lainnya';
const KIND_ITEMS: ScreenerTabItem[] = [
  { id: 'all', label: 'Semua', icon: LayoutGrid },
  { id: 'emiten', label: 'Analisa Emiten', icon: LineChart },
  { id: 'lainnya', label: 'Insight & Update', icon: Newspaper },
];

const EXPLORE_LINKS = [
  { href: '/screener', label: 'Screener Saham', hint: 'Saring saham dengan preset & filter', icon: ScanSearch },
  { href: '/signal', label: 'SARA AI Signals', hint: 'Sinyal harian dengan trade plan', icon: Radar },
  { href: '/panduan', label: 'Panduan Istilah', hint: 'Pahami istilah di setiap artikel', icon: BookOpen },
];

function formatDate(date: string) {
  if (!date) return '';
  return new Date(date).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
}

/** Ticker tile for stock articles (same look as the Detail Emiten avatar), a document icon otherwise. */
function PostAvatar({ post, size = 'md' }: { post: BlogPostMeta; size?: 'md' | 'lg' }) {
  const box = size === 'lg' ? 'size-16 text-xl' : 'size-11 text-sm';
  return (
    <span className={cn('flex shrink-0 items-center justify-center rounded-lg bg-(--sv-primary) font-bold text-(--sv-primary-fg)', box)}>
      {post.embedTicker ? post.embedTicker.slice(0, 2) : <FileText className={size === 'lg' ? 'size-7' : 'size-5'} strokeWidth={2} />}
    </span>
  );
}

function PostMeta({ post }: { post: BlogPostMeta }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-(--sv-muted)">
      {post.date && (
        <span className="inline-flex items-center gap-1"><CalendarDays className="size-3.5" strokeWidth={2} />{formatDate(post.date)}</span>
      )}
      {post.author && (
        <span className="inline-flex items-center gap-1"><UserRound className="size-3.5" strokeWidth={2} />{post.author}</span>
      )}
    </div>
  );
}

function FeaturedPost({ post }: { post: BlogPostMeta }) {
  return (
    <Link href={`/blog/${post.slug}`} className="group block">
      <Card className="flex flex-col gap-4 p-5 transition-shadow group-hover:border-(--sv-primary)/40 group-hover:shadow-md sm:flex-row sm:items-start">
        <PostAvatar post={post} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge tone="info">Artikel terbaru</Badge>
            {post.embedTicker && <Badge>{post.embedTicker}</Badge>}
          </div>
          <h2 className="text-xl font-bold leading-snug text-(--sv-text) group-hover:text-(--sv-primary) sm:text-2xl">{post.title}</h2>
          {post.description && <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-(--sv-muted)">{post.description}</p>}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <PostMeta post={post} />
            <span className="inline-flex items-center gap-1 text-sm font-semibold text-(--sv-primary)">
              Baca artikel <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </div>
        </div>
      </Card>
    </Link>
  );
}

function PostCard({ post }: { post: BlogPostMeta }) {
  return (
    <Link href={`/blog/${post.slug}`} className="group block h-full">
      <Card as="div" className="flex h-full flex-col gap-3 p-4 transition-shadow group-hover:border-(--sv-primary)/40 group-hover:shadow-md">
        <div className="flex items-start gap-3">
          <PostAvatar post={post} />
          <div className="min-w-0 flex-1">
            <h3 className="line-clamp-2 text-[15px] font-semibold leading-snug text-(--sv-text) group-hover:text-(--sv-primary)">{post.title}</h3>
            {post.embedTicker && <span className="mt-1 block text-xs font-medium text-(--sv-muted)">{post.embedTicker}</span>}
          </div>
        </div>
        {post.description && <p className="line-clamp-3 text-sm leading-relaxed text-(--sv-muted)">{post.description}</p>}
        <div className="mt-auto flex items-center justify-between gap-2 border-t border-(--sv-border) pt-3">
          <PostMeta post={post} />
          <ChevronRight className="size-4 shrink-0 text-(--sv-muted) transition-transform group-hover:translate-x-0.5 group-hover:text-(--sv-primary)" />
        </div>
      </Card>
    </Link>
  );
}

export function BlogListPage({ posts }: { posts: BlogPostMeta[] }) {
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<Kind>('all');
  const [page, setPage] = useState(1);

  const q = query.trim().toLowerCase();
  const filtered = useMemo(() => posts.filter((p) => {
    if (kind === 'emiten' && !p.embedTicker) return false;
    if (kind === 'lainnya' && p.embedTicker) return false;
    if (!q) return true;
    return p.title.toLowerCase().includes(q) || p.description.toLowerCase().includes(q) || (p.embedTicker ?? '').toLowerCase().includes(q);
  }), [posts, kind, q]);

  // Tickers covered by the blog, most-written first — quick filters in the side panel.
  const tickers = useMemo(() => {
    const count = new Map<string, number>();
    for (const p of posts) if (p.embedTicker) count.set(p.embedTicker, (count.get(p.embedTicker) ?? 0) + 1);
    return [...count].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [posts]);

  const browsing = !q && kind === 'all';
  const featured = browsing && page === 1 ? filtered[0] : undefined;
  const rest = featured ? filtered.slice(1) : filtered;
  const pageCount = Math.max(1, Math.ceil(rest.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageItems = rest.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const handleQuery = (next: string) => { setQuery(next); setPage(1); };
  const reset = () => { setQuery(''); setKind('all'); setPage(1); };
  const goPage = (p: number) => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  return (
    <AppShell query={query} onQueryChange={handleQuery}>
      <nav aria-label="Breadcrumb" className="text-sm">
        <ol className="flex items-center gap-1.5 text-(--sv-muted)">
          <li><Link href="/" aria-label="Beranda" className="flex items-center hover:text-(--sv-text)"><Home className="size-4" strokeWidth={2} /></Link></li>
          <ChevronRight className="size-3.5" aria-hidden="true" />
          <li aria-current="page" className="font-medium text-(--sv-text)">Blog</li>
        </ol>
      </nav>

      <div>
        <h1 className="text-xl font-bold text-(--sv-text) sm:text-2xl">Blog</h1>
        <p className="mt-0.5 text-sm text-(--sv-muted)">Analisis saham, tips trading, dan pembaruan seputar EzySaham AI.</p>
      </div>

      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] 2xl:grid-cols-[minmax(0,1fr)_22rem]">
        <main className="flex min-w-0 flex-col gap-4">
          <ScreenerTabs items={KIND_ITEMS} selected={kind} onSelect={(id) => { setKind(id as Kind); setPage(1); }} count={filtered.length} />

          {!browsing && (
            <p className="text-sm text-(--sv-muted)">
              <b className="tabular-nums text-(--sv-text)">{filtered.length}</b> dari {posts.length} artikel
              {q && <> cocok dengan &ldquo;<span className="text-(--sv-text)">{query.trim()}</span>&rdquo;</>}
              <button type="button" onClick={reset} className="ml-2 font-medium text-(--sv-primary) hover:underline">Hapus filter</button>
            </p>
          )}

          {filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-(--sv-border) bg-(--sv-surface) px-6 py-14 text-center">
              <span className="flex size-12 items-center justify-center rounded-full bg-(--sv-primary-soft) text-(--sv-primary)">
                <SearchX className="size-6" strokeWidth={2} />
              </span>
              <p className="text-base font-semibold text-(--sv-text)">{posts.length === 0 ? 'Belum ada artikel' : 'Artikel tidak ditemukan'}</p>
              <p className="max-w-sm text-sm text-(--sv-muted)">
                {posts.length === 0 ? 'Belum ada artikel yang dipublikasikan.' : 'Coba kata kunci lain atau kode saham, mis. BBRI, PTBA.'}
              </p>
              {posts.length > 0 && (
                <button type="button" onClick={reset} className="mt-1 rounded-lg border border-(--sv-border) px-3.5 py-2 text-sm font-medium text-(--sv-text) hover:bg-(--sv-bg)">
                  Lihat semua artikel
                </button>
              )}
            </div>
          ) : (
            <>
              {featured && <FeaturedPost post={featured} />}
              {pageItems.length > 0 && (
                <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                  {pageItems.map((p) => <PostCard key={p.slug} post={p} />)}
                </div>
              )}
              <ScreenerPagination page={currentPage} pageSize={PAGE_SIZE} total={rest.length} onPage={goPage} unit="artikel" />
            </>
          )}
        </main>

        <aside aria-label="Navigasi blog" className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-20 lg:self-start">
          {tickers.length > 0 && (
            <Card>
              <PanelTitle icon={LineChart}>Saham yang Dibahas</PanelTitle>
              <div className="flex flex-wrap gap-2 p-4">
                {tickers.map(([t, n]) => {
                  const active = q === t.toLowerCase();
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => handleQuery(active ? '' : t)}
                      aria-pressed={active}
                      className={cn(
                        'inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition-colors',
                        active ? 'border-(--sv-primary) bg-(--sv-primary) text-(--sv-primary-fg)' : 'border-(--sv-border) text-(--sv-text) hover:bg-(--sv-bg)',
                      )}
                    >
                      {t}
                      {n > 1 && <span className="tabular-nums opacity-70">{n}</span>}
                    </button>
                  );
                })}
              </div>
            </Card>
          )}

          <Card>
            <PanelTitle icon={ScanSearch}>Jelajahi Fitur</PanelTitle>
            <ul className="divide-y divide-(--sv-border)">
              {EXPLORE_LINKS.map(({ href, label, hint, icon: Icon }) => (
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
    </AppShell>
  );
}
