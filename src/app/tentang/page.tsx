import { Metadata } from 'next';
import { TentangPage } from '@/presentation/features/tentang/TentangPage';

export const metadata: Metadata = {
  title: 'Tentang | EzySaham AI',
  description: 'Apa itu EzySaham AI, bagaimana cara kerjanya, filosofi desain, serta keterbatasan dan disclaimer penggunaannya.',
};

export default function Page() {
  return <TentangPage />;
}
