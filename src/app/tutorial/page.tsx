import { Metadata } from 'next';
import { TutorialPage } from '@/presentation/features/tutorial/TutorialPage';

export const metadata: Metadata = {
  title: 'Tutorial | EzySaham AI',
  description: 'Panduan langkah demi langkah menggunakan Screener EzySaham AI, dari memilih preset hingga membaca hasil analisis.',
};

export default function Page() {
  return <TutorialPage />;
}
