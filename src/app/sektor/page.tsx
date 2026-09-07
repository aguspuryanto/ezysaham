import { Metadata } from 'next';
import { SectorPage } from '@/presentation/features/sector/SectorPage';

interface Props {
  searchParams: Promise<{ sector?: string }>;
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { sector } = await searchParams;
  return {
    title: sector ? `Saham Sektor ${sector} | StockPilot AI` : 'Saham per Sektor | StockPilot AI',
    description: sector
      ? `Daftar saham BEI/IDX di sektor ${sector}, lengkap dengan harga, perubahan harian, dan kapitalisasi pasar.`
      : 'Jelajahi seluruh saham BEI/IDX dikelompokkan per sektor, lengkap dengan performa rata-rata dan kapitalisasi pasar tiap sektor.',
  };
}

export default async function Page({ searchParams }: Props) {
  const { sector } = await searchParams;
  return <SectorPage initialSector={sector ?? null} />;
}
