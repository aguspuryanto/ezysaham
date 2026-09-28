import { ChevronRight, Home } from 'lucide-react';
import Link from 'next/link';

export function Breadcrumb({ ticker }: { ticker: string }) {
  return (
    <nav aria-label="Breadcrumb" className="text-sm">
      <ol className="flex flex-wrap items-center gap-1.5 text-(--sv-muted)">
        <li>
          <Link href="/" aria-label="Beranda" className="flex items-center hover:text-(--sv-text)">
            <Home className="size-4" strokeWidth={2} />
          </Link>
        </li>
        <ChevronRight className="size-3.5" aria-hidden="true" />
        <li>
          <Link href="/screener" className="hover:text-(--sv-text)">Screener Saham</Link>
        </li>
        <ChevronRight className="size-3.5" aria-hidden="true" />
        <li aria-current="page" className="font-medium text-(--sv-text)">
          Detail Emiten <span className="text-(--sv-muted)">· {ticker}</span>
        </li>
      </ol>
    </nav>
  );
}
