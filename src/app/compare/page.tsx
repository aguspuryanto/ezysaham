import { Metadata } from 'next';
import { SITE_NAME } from '@/lib/site';
import { ComparePage } from '@/presentation/features/compare/ComparePage';

interface Props {
  searchParams: Promise<{ a?: string; b?: string }>;
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { a, b } = await searchParams;
  const tickerA = (a || 'BRPT').toUpperCase();
  const tickerB = (b || 'TPIA').toUpperCase();
  return {
    title: `Bandingkan ${tickerA} vs ${tickerB} | ${SITE_NAME}`,
    description: `Perbandingan harga, fundamental, dan sinyal AI antara saham ${tickerA} dan ${tickerB}.`,
  };
}

export default async function Page({ searchParams }: Props) {
  const { a, b } = await searchParams;
  const tickerA = (a || 'BRPT').toUpperCase();
  const tickerB = (b || 'TPIA').toUpperCase();
  return <ComparePage key={`${tickerA}-${tickerB}`} initialTickerA={tickerA} initialTickerB={tickerB} />;
}
