import { Metadata } from 'next';
import { SITE_NAME } from '@/lib/site';
import { JournalPage } from '@/presentation/features/journal/JournalPage';

export const metadata: Metadata = {
  title: `Jurnal Trading | ${SITE_NAME}`,
  description: 'Catat rencana Entry/TP/SL dan lihat hasilnya otomatis terhadap harga penutupan EOD hari bursa berikutnya.',
};

export default function Page() {
  return <JournalPage />;
}
