import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';

const inter = Inter({
  variable: '--font-terminal-sans',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
});

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-terminal-mono',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: 'Terminal Screener — EzySaham',
  description: 'Terminal screener saham IDX bergaya dashboard institusional — data real-time EOD, skor AI, dan sinyal per saham.',
};

export default function TerminalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${inter.variable} ${jetbrainsMono.variable} terminal-theme min-h-screen`}>
      {children}
    </div>
  );
}
