import { Metadata } from 'next';
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
  return <StockAnalysisPage ticker={ticker.toUpperCase()} />;
}
