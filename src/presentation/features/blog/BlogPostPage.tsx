/**
 * BlogPostPage.tsx
 *
 * /blog/[slug] — a single article in the Screener's `.sv-theme` shell, laid out
 * like Detail Emiten: header card, content column, sticky right panel with the
 * table of contents. Server component; AppShell and StockEmbed are the client parts.
 */

import type { LucideIcon } from 'lucide-react';
import { ArrowRight, BookOpen, CalendarDays, ChevronRight, Clock, FileText, Home, ListTree, Radar, ScanSearch, UserRound } from 'lucide-react';
import Link from 'next/link';
import { getAllPosts, type BlogPost, type BlogPostMeta } from '@/lib/blog';
import { cn } from '@/lib/format';
import { AppShell } from '../screener/components/AppShell';
import { Badge, Card } from '../screener/detail/components/ui';
import { readingMinutes, withHeadingAnchors } from './postContent';
import { StockEmbed } from './StockEmbed';

const RELATED_COUNT = 3;

const EXPLORE_LINKS = [
  { href: '/screener', label: 'Screener Saham', hint: 'Saring saham dengan preset & filter', icon: ScanSearch },
  { href: '/signal', label: 'SARA AI Signals', hint: 'Sinyal harian dengan trade plan', icon: Radar },
  { href: '/panduan', label: 'Panduan Istilah', hint: 'Pahami istilah di artikel ini', icon: BookOpen },
];

function formatDate(date: string) {
  if (!date) return '';
  return new Date(date).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
}

function PostAvatar({ post, className }: { post: BlogPostMeta; className?: string }) {
  return (
    <span className={cn('flex shrink-0 items-center justify-center rounded-lg bg-(--sv-primary) font-bold text-(--sv-primary-fg)', className)}>
      {post.embedTicker ? post.embedTicker.slice(0, 2) : <FileText className="size-1/2" strokeWidth={2} />}
    </span>
  );
}

/** Server-side twin of the Detail Emiten PanelTitle (that one is a client module and takes an icon component prop). */
function PanelHeading({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 border-b border-(--sv-border) px-4 py-3">
      <Icon className="size-4.5 text-(--sv-primary)" strokeWidth={2} />
      <h2 className="text-[15px] font-semibold text-(--sv-text)">{children}</h2>
    </div>
  );
}

/** Same-ticker articles first, then the newest others. */
function relatedPosts(post: BlogPost): BlogPostMeta[] {
  const others = getAllPosts().filter((p) => p.slug !== post.slug);
  const sameTicker = post.embedTicker ? others.filter((p) => p.embedTicker === post.embedTicker) : [];
  return [...sameTicker, ...others.filter((p) => !sameTicker.includes(p))].slice(0, RELATED_COUNT);
}

export function BlogPostPage({ post }: { post: BlogPost }) {
  const { html, toc } = withHeadingAnchors(post.contentHtml);
  const minutes = readingMinutes(post.contentHtml);
  const related = relatedPosts(post);

  return (
    <AppShell>
      <nav aria-label="Breadcrumb" className="text-sm">
        <ol className="flex min-w-0 items-center gap-1.5 text-(--sv-muted)">
          <li><Link href="/" aria-label="Beranda" className="flex items-center hover:text-(--sv-text)"><Home className="size-4" strokeWidth={2} /></Link></li>
          <ChevronRight className="size-3.5 shrink-0" aria-hidden="true" />
          <li><Link href="/blog" className="hover:text-(--sv-text)">Blog</Link></li>
          <ChevronRight className="size-3.5 shrink-0" aria-hidden="true" />
          <li aria-current="page" className="min-w-0 truncate font-medium text-(--sv-text)">{post.title}</li>
        </ol>
      </nav>

      <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start">
        <PostAvatar post={post} className="size-14 text-lg" />
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge tone="info">{post.embedTicker ? 'Analisa Emiten' : 'Insight & Update'}</Badge>
            {post.embedTicker && <Badge>{post.embedTicker}</Badge>}
          </div>
          <h1 className="text-2xl font-bold leading-tight text-(--sv-text) sm:text-3xl">{post.title}</h1>
          {post.description && <p className="mt-2 max-w-3xl text-sm leading-relaxed text-(--sv-muted)">{post.description}</p>}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-(--sv-muted)">
            {post.date && <span className="inline-flex items-center gap-1"><CalendarDays className="size-3.5" strokeWidth={2} />{formatDate(post.date)}</span>}
            {post.author && <span className="inline-flex items-center gap-1"><UserRound className="size-3.5" strokeWidth={2} />{post.author}</span>}
            <span className="inline-flex items-center gap-1"><Clock className="size-3.5" strokeWidth={2} />{minutes} menit baca</span>
          </div>
        </div>
      </Card>

      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] 2xl:grid-cols-[minmax(0,1fr)_22rem]">
        <main className="flex min-w-0 flex-col gap-4">
          {post.embedTicker && <StockEmbed ticker={post.embedTicker} />}

          <Card as="div" className="p-5 sm:p-8">
            <article
              className={cn(
                'prose prose-slate max-w-none dark:prose-invert',
                'prose-headings:scroll-mt-24 prose-headings:font-semibold prose-headings:text-(--sv-text)',
                'prose-h2:mt-10 prose-h2:border-b prose-h2:border-(--sv-border) prose-h2:pb-2 prose-h2:text-xl prose-h3:text-lg',
                'prose-p:text-(--sv-text) prose-li:text-(--sv-text) prose-strong:text-(--sv-text) prose-blockquote:border-(--sv-primary) prose-blockquote:text-(--sv-muted)',
                'prose-a:font-medium prose-a:text-(--sv-primary) prose-hr:border-(--sv-border)',
                'prose-table:text-sm prose-th:bg-(--sv-bg) prose-th:px-3 prose-th:py-2 prose-th:text-(--sv-text) prose-td:px-3 prose-td:text-(--sv-text) prose-tr:border-(--sv-border) prose-thead:border-(--sv-border)',
                '[&_table]:block [&_table]:overflow-x-auto',
              )}
              dangerouslySetInnerHTML={{ __html: html }}
            />
          </Card>

          <p className="text-xs leading-relaxed text-(--sv-muted)">
            Artikel ini bersifat edukasi dan bukan ajakan membeli atau menjual saham. Selalu lakukan riset mandiri dan sesuaikan dengan profil risiko Anda.
          </p>

          {related.length > 0 && (
            <section aria-labelledby="related-title" className="flex flex-col gap-3">
              <div className="flex items-baseline justify-between gap-2">
                <h2 id="related-title" className="text-lg font-semibold text-(--sv-text)">Artikel Terkait</h2>
                <Link href="/blog" className="inline-flex items-center gap-1 text-sm font-medium text-(--sv-primary) hover:underline">
                  Semua artikel <ArrowRight className="size-4" />
                </Link>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                {related.map((p) => (
                  <Link key={p.slug} href={`/blog/${p.slug}`} className="group block h-full">
                    <Card as="div" className="flex h-full flex-col gap-3 p-4 transition-shadow group-hover:border-(--sv-primary)/40 group-hover:shadow-md">
                      <div className="flex items-start gap-3">
                        <PostAvatar post={p} className="size-10 text-sm" />
                        <h3 className="line-clamp-3 text-sm font-semibold leading-snug text-(--sv-text) group-hover:text-(--sv-primary)">{p.title}</h3>
                      </div>
                      {p.date && (
                        <span className="mt-auto inline-flex items-center gap-1 text-xs text-(--sv-muted)">
                          <CalendarDays className="size-3.5" strokeWidth={2} />{formatDate(p.date)}
                        </span>
                      )}
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </main>

        <aside aria-label="Navigasi artikel" className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:self-start lg:overflow-y-auto [scrollbar-width:thin]">
          {toc.length > 0 && (
            <Card>
              <PanelHeading icon={ListTree}>Daftar Isi</PanelHeading>
              <ol className="flex flex-col p-2 text-sm">
                {toc.map((item) => (
                  <li key={item.id}>
                    <a
                      href={`#${item.id}`}
                      className={cn(
                        'block rounded-lg px-3 py-1.5 leading-snug hover:bg-(--sv-bg) hover:text-(--sv-primary)',
                        item.level === 2 ? 'font-medium text-(--sv-text)' : 'pl-6 text-[13px] text-(--sv-muted)',
                      )}
                    >
                      {item.text}
                    </a>
                  </li>
                ))}
              </ol>
            </Card>
          )}

          <Card>
            <PanelHeading icon={ScanSearch}>Jelajahi Fitur</PanelHeading>
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
