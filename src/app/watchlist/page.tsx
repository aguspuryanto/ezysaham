import { Metadata } from 'next';
import { SITE_NAME } from '@/lib/site';
import { WatchlistPage } from '@/presentation/features/watchlist/WatchlistPage';

export const metadata: Metadata = {
  title: `Watchlist | ${SITE_NAME}`,
  description: 'Pantau saham BEI/IDX yang Anda tandai — harga, fair value, upside, fase pasar, trend, fundamental dan risiko dalam satu tabel.',
  // Personal list stored in the browser — nothing to index.
  robots: { index: false },
};

export default function Page() {
  return <WatchlistPage />;
}
