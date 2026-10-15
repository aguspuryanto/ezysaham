import { Metadata } from 'next';
import { SITE_NAME } from '@/lib/site';
import { TopBuyPage } from '@/presentation/features/topbuy/TopBuyPage';

export const metadata: Metadata = {
  title: `Rekomendasi Saham | ${SITE_NAME}`,
  description: 'Rekomendasi Saham: saham pilihan berdasarkan kriteria likuiditas, valuasi dan momentum mingguan, lalu divalidasi Decision Engine v3.',
};

export default function Page() {
  return <TopBuyPage />;
}
