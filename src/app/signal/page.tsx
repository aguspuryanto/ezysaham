import { Metadata } from 'next';
import { SITE_NAME } from '@/lib/site';
import { SignalPage } from '@/presentation/features/signal/SignalPage';

export const metadata: Metadata = {
  title: `SARA AI Signals | ${SITE_NAME}`,
  description: 'Sinyal saham harian berbasis algoritma: entry zone, target, stop loss, dan jawaban cepat "Boleh entry?".',
};

export default function Page() {
  return <SignalPage />;
}
