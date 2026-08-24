import { Metadata } from 'next';
import { PanduanPage } from '@/presentation/features/panduan/PanduanPage';

export const metadata: Metadata = {
  title: 'Panduan Istilah | EzySaham AI',
  description: 'Penjelasan sederhana istilah saham, indikator teknikal, rasio fundamental, dan istilah skor yang digunakan di EzySaham AI.',
};

export default function Page() {
  return <PanduanPage />;
}
