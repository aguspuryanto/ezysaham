import Link from 'next/link';
import { ArrowLeft, CalendarDays, User } from 'lucide-react';
import { ContentHeader } from '@/presentation/components/layout/ContentHeader';
import { StockEmbed } from './StockEmbed';
import type { BlogPost } from '@/lib/blog';

function formatDate(date: string) {
  if (!date) return '';
  return new Date(date).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
}

export function BlogPostPage({ post }: { post: BlogPost }) {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <ContentHeader active="blog" />

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-8 pb-16 sm:px-6">
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
      </main>
    </div>
  );
}
