import { Metadata } from 'next';
import { SITE_NAME } from '@/lib/site';
import { SmartMoneyPage } from '@/presentation/features/smartmoney/SmartMoneyPage';

export const metadata: Metadata = {
  title: `SmartMoney | ${SITE_NAME}`,
  description: 'Smart Money Accumulation Hunter: indikasi akumulasi asing dan broker, aktivitas transaksi, momentum, dan fundamental saham BEI.',
};

export default function Page() {
  return <SmartMoneyPage />;
}
