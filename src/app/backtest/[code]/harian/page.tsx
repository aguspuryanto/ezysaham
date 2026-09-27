import { Metadata } from 'next';
import { DailyBacktestPage } from '@/presentation/features/backtest/DailyBacktestPage';

interface Props {
  params: Promise<{ code: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  const ticker = code.toUpperCase();
  return {
    title: `Backtest Harian ${ticker} | StockPilot AI`,
    description: `Simulasi day trade saham ${ticker} selama 60 hari bursa terakhir: beli di Open, jual di hari yang sama (TP / SL / Close).`,
  };
}

export default async function Page({ params }: Props) {
  const { code } = await params;
  return <DailyBacktestPage ticker={code.toUpperCase()} />;
}
