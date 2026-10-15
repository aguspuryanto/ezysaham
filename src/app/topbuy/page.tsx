import { Metadata } from 'next';
import { SITE_NAME } from '@/lib/site';
import { TopBuyPage } from '@/presentation/features/topbuy/TopBuyPage';

export const metadata: Metadata = {
  title: `Top BUY | ${SITE_NAME}`,
  description: 'Top BUY: saham lolos kriteria likuiditas, valuasi dan momentum mingguan, lalu divalidasi Decision Engine v3.',
};

export default function Page() {
  return <TopBuyPage />;
}
