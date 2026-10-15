import { Metadata } from 'next';
import { SITE_NAME } from '@/lib/site';
import { BestPerformingPage } from '@/presentation/features/bestperforming/BestPerformingPage';

export const metadata: Metadata = {
  title: `Kinerja Terbaik | ${SITE_NAME}`,
  description: '50 saham BEI/IDX likuid dengan performa 1 bulan, 3 bulan, 6 bulan, YTD dan 1 tahun terbaik, lengkap dengan analisa bentuk kenaikan dan trend.',
};

export default function Page() {
  return <BestPerformingPage />;
}
