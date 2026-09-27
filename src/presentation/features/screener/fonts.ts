import { Inter } from 'next/font/google';

/** Screener-only typeface; exposed as a CSS variable consumed by `.sv-theme` in globals.css. */
export const screenerInter = Inter({
  subsets: ['latin'],
  variable: '--font-sv-inter',
  display: 'swap',
});
