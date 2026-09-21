import { Metadata } from 'next';
import { StockAnalysisPageV3 } from '@/presentation/features/analysis/StockAnalysisPageV3';
import { StockAnalysisPageV2 } from '@/presentation/features/analysis/StockAnalysisPageV2';
import { StockAnalysisPageNew } from '@/presentation/features/analysis/StockAnalysisPageNew';
import { StockAnalysisPage } from '@/presentation/features/analysis/StockAnalysisPage';

interface Props {
  params: Promise<{ ticker: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { ticker } = await params;
  const code = ticker.toUpperCase();
  return {
    title: `Analisis Teknikal ${code} | StockPilot AI`,
    description: `Analisis teknikal lengkap saham ${code}: Trend EMA, Support Resistance, Price Action, Volume, Indikator, dan Rencana Trading.`,
  };
}

export default async function Page({ params }: Props) {
  const { ticker } = await params;
  return <StockAnalysisPageV3 ticker={ticker.toUpperCase()} />;
  // return <StockAnalysisPageV2 ticker={ticker.toUpperCase()} />;
  // return <StockAnalysisPageNew ticker={ticker.toUpperCase()} />;
  // return <StockAnalysisPage ticker={ticker.toUpperCase()} />;
}
