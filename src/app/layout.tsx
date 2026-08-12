import type { Metadata } from "next";
import { Space_Grotesk, Geist_Mono } from "next/font/google";
import { SITE_NAME } from "@/lib/site";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: SITE_NAME,
  description: "Screening saham IDX, jadi lebih mudah dan cepat",
  keywords: ["saham", "IDX", "AI", "screening", "trading", "investing", "investasi", "trading saham", "screener saham", "skrining saham", "skrining saham idx"],
  authors: [{ name: SITE_NAME }],
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>{children}</body>
    </html>
  );
}
