import { Metadata } from 'next';
import { TechnicalHistoryPage } from '@/presentation/features/history/TechnicalHistoryPage';

interface Props {
  params: Promise<{ code: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  const ticker = code.toUpperCase();
  return {
    title: `Riwayat Teknikal ${ticker} | StockPilot AI`,
    description: `Riwayat teknikal saham ${ticker}: Volume History, Price Action History, Breakout History, Accumulation/Distribution History, Indicator Cross History, dan Historical Pattern.`,
  };
}

export default async function Page({ params }: Props) {
  const { code } = await params;
  return <TechnicalHistoryPage ticker={code.toUpperCase()} />;
}
