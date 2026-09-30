/** Server-side helpers for rendering a blog post's markdown HTML. */

export interface TocItem {
  id: string;
  text: string;
  level: 2 | 3;
}

const ENTITIES: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" };

function plainText(html: string): string {
  return html.replace(/<[^>]+>/g, '').replace(/&(amp|lt|gt|quot|#39);/g, (m) => ENTITIES[m]).trim();
}

function slugify(text: string): string {
  return text.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-') || 'bagian';
}

/** Adds stable ids to <h2>/<h3> (marked emits none) and returns them as a table of contents. */
export function withHeadingAnchors(html: string): { html: string; toc: TocItem[] } {
  const toc: TocItem[] = [];
  const used = new Map<string, number>();
  const out = html.replace(/<h([23])>([\s\S]*?)<\/h\1>/g, (_, level: string, inner: string) => {
    const text = plainText(inner);
    const base = slugify(text);
    const n = used.get(base) ?? 0;
    used.set(base, n + 1);
    const id = n === 0 ? base : `${base}-${n + 1}`;
    toc.push({ id, text, level: Number(level) as 2 | 3 });
    return `<h${level} id="${id}">${inner}</h${level}>`;
  });
  return { html: out, toc };
}

export function readingMinutes(html: string): number {
  const words = plainText(html).split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}
