import Link from 'next/link';
import { ArrowLeft, CalendarDays, User } from 'lucide-react';
import { ContentHeader } from '@/presentation/components/layout/ContentHeader';
import { StockEmbed } from './StockEmbed';
import { getAllPosts, type BlogPost } from '@/lib/blog';

function formatDate(date: string) {
  if (!date) return '';
  return new Date(date).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
}

export function BlogPostPage({ post }: { post: BlogPost }) {
  const related = getAllPosts()
    .filter((p) => p.slug !== post.slug)
    .slice(0, 3);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <ContentHeader active="blog" />

      <main className="mx-auto max-w-4xl space-y-6 px-4 py-8 pb-16 sm:px-6">
        <Link
          href="/blog"
          className="flex w-fit items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          <ArrowLeft className="size-3.5" strokeWidth={2.5} />
          <span>Kembali ke Blog</span>
        </Link>

        <article className="space-y-6">
          <header className="space-y-3">
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-3xl">
              {post.title}
            </h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              {post.date && (
                <div className="flex items-center gap-1.5">
                  <CalendarDays className="size-3.5" strokeWidth={2.5} />
                  <span>{formatDate(post.date)}</span>
                </div>
              )}
              {post.author && (
                <div className="flex items-center gap-1.5">
                  <User className="size-3.5" strokeWidth={2.5} />
                  <span>{post.author}</span>
                </div>
              )}
            </div>
          </header>

          {post.embedTicker && <StockEmbed ticker={post.embedTicker} />}

          <div
            className="prose prose-zinc max-w-none neo-border neo-shadow bg-white p-5 prose-headings:font-bold prose-headings:uppercase prose-headings:tracking-tight prose-a:font-semibold prose-a:text-(--neo-accent) sm:p-8 dark:prose-invert dark:bg-zinc-900"
            dangerouslySetInnerHTML={{ __html: post.contentHtml }}
          />
        </article>

        {related.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Rekomendasi Analisa Saham Lainnya
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {related.map((p) => (
                <Link
                  key={p.slug}
                  href={`/blog/${p.slug}`}
                  className="neo-press flex flex-col neo-border neo-shadow-sm bg-white p-4 transition-transform dark:bg-zinc-900"
                >
                  <h3 className="line-clamp-2 text-sm font-bold text-zinc-900 dark:text-zinc-50">
                    {p.title}
                  </h3>
                  {p.description && (
                    <p className="mt-1.5 line-clamp-3 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                      {p.description}
                    </p>
                  )}
                  {p.date && (
                    <div className="mt-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                      <CalendarDays className="size-3" strokeWidth={2.5} />
                      <span>{formatDate(p.date)}</span>
                    </div>
                  )}
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
