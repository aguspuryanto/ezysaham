import { Metadata } from 'next';
import { StockBacktestPage } from '@/presentation/features/backtest/StockBacktestPage';

interface Props {
  params: Promise<{ code: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  const ticker = code.toUpperCase();
  return {
    title: `Backtest ${ticker} | StockPilot AI`,
    description: `Backtest objektif saham ${ticker}: Market Structure + EMA 8/18/200 + Momentum Candle + Volume, dengan validasi In-Sample / Out-of-Sample.`,
  };
}

export default async function Page({ params }: Props) {
  const { code } = await params;
  return <StockBacktestPage ticker={code.toUpperCase()} />;
}
