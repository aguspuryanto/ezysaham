import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { LINKS, SITE_NAME } from '@/lib/site';

export function ContentHeader({ active }: { active: 'tutorial' | 'panduan' | 'blog' | 'tentang' }) {
  return (
    <header className="sticky top-0 z-20 neo-border border-x-0 border-t-0 bg-white dark:bg-zinc-950">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          <ArrowLeft className="size-4" strokeWidth={2.5} />
          <span>{SITE_NAME}</span>
        </Link>
        <div className="hidden h-5 w-[3px] bg-(--neo-line) sm:block" />
        <nav className="ml-auto flex items-center gap-1.5">
          {LINKS.map(({ href, label, icon: Icon }) => {
            const isActive = href === `/${active}`;
            return (
              <Link
                key={href}
                href={href}
                className={
                  isActive
                    ? 'flex items-center gap-1.5 neo-border bg-(--neo-accent) px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-black'
                    : 'flex items-center gap-1.5 border-2 border-transparent px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-zinc-500 transition-colors hover:border-(--neo-line) dark:text-zinc-400'
                }
              >
                <Icon className="size-3.5" strokeWidth={2.5} />
                <span className="hidden sm:inline">{label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
