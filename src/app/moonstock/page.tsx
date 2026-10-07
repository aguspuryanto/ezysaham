import { Metadata } from 'next';
import { SITE_NAME } from '@/lib/site';
import { MoonstockPage } from '@/presentation/features/moonstock/MoonstockPage';

export const metadata: Metadata = {
  title: `Moonstock | ${SITE_NAME}`,
  description: 'Discovery radar saham: Moonstock Intraday, Swing dan Investing — kandidat untuk divalidasi Momentum Trade Engine.',
};

export default function Page() {
  return <MoonstockPage />;
}
