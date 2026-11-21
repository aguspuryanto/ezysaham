import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BookOpen } from "lucide-react";
import { ARTICLES, getArticle } from "@/lib/articles";
import { Badge } from "@/components/ui/misc";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return ARTICLES.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const a = getArticle((await params).slug);
  return a ? { title: a.title, description: a.summary } : {};
}

export default async function ArticlePage({ params }: Props) {
  const article = getArticle((await params).slug);
  if (!article) notFound();
  const others = ARTICLES.filter((a) => a.slug !== article.slug).slice(0, 3);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link href="/news" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Semua tips
      </Link>

      <article className="space-y-5">
        <header className="space-y-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline">{article.category}</Badge>
            <span className="flex items-center gap-1"><BookOpen className="size-3" /> {article.minutes} menit baca</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-balance sm:text-3xl">{article.title}</h1>
          <p className="text-muted-foreground">{article.summary}</p>
        </header>

        {article.sections.map((s, i) => (
          <section key={i} className="space-y-3">
            {s.heading && <h2 className="text-lg font-semibold">{s.heading}</h2>}
            {s.paragraphs.map((p, j) => (
              <p key={j} className="leading-relaxed">{p}</p>
            ))}
            {s.bullets && (
              <ul className="space-y-2 pl-1">
                {s.bullets.map((b) => (
                  <li key={b} className="flex gap-2.5 leading-relaxed">
                    <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-primary" />
                    {b}
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </article>

      <aside className="space-y-3 border-t pt-6">
        <h2 className="font-semibold">Baca juga</h2>
        <ul className="space-y-2">
          {others.map((a) => (
            <li key={a.slug}>
              <Link href={`/news/${a.slug}`} className="block rounded-lg border bg-card p-3 hover:border-primary/50">
                <p className="text-sm font-medium">{a.title}</p>
                <p className="line-clamp-1 text-xs text-muted-foreground">{a.summary}</p>
              </Link>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
