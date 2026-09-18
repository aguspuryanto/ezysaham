import { Metadata } from 'next';
import { MoversPage } from '@/presentation/features/movers/MoversPage';

export const metadata: Metadata = {
  title: 'Top 50 Gainer Hari Ini | StockPilot AI',
  description: 'Daftar 50 saham BEI/IDX dengan kenaikan harga terbesar hari ini, lengkap dengan harga dan perubahan harian.',
};

export default function Page() {
  return <MoversPage direction="gainers" />;
}
