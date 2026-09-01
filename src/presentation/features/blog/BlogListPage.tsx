import Link from 'next/link';
import { CalendarDays } from 'lucide-react';
import { ContentHeader } from '@/presentation/components/layout/ContentHeader';
import type { BlogPostMeta } from '@/lib/blog';

function formatDate(date: string) {
  if (!date) return '';
  return new Date(date).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
}

export function BlogListPage({ posts }: { posts: BlogPostMeta[] }) {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <ContentHeader active="blog" />

      <main className="mx-auto max-w-4xl space-y-6 px-4 py-8 pb-16 sm:px-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold uppercase tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-3xl">
            Blog
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            Analisis saham, tips trading, dan pembaruan seputar EzySaham AI.
          </p>
        </div>

        {posts.length === 0 && (
          <div className="neo-border neo-shadow bg-white p-6 text-center text-sm font-semibold text-zinc-400 dark:bg-zinc-900">
            Belum ada artikel yang dipublikasikan.
          </div>
        )}

        <div className="space-y-4">
          {posts.map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="neo-press block neo-border neo-shadow-sm bg-white p-5 transition-transform dark:bg-zinc-900"
            >
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">{post.title}</h2>
              {post.description && (
                <p className="mt-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                  {post.description}
                </p>
              )}
              {post.date && (
                <div className="mt-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  <CalendarDays className="size-3.5" strokeWidth={2.5} />
                  <span>{formatDate(post.date)}</span>
                </div>
              )}
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
