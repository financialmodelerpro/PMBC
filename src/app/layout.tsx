import type { Metadata } from 'next';
import { Inter, Source_Serif_4 } from 'next/font/google';
import './globals.css';

import { ogImageFor, siteUrl } from '@/lib/seo/metadata';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

const sourceSerif = Source_Serif_4({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-source-serif',
  weight: ['400', '500', '600', '700'],
});

const BASE = siteUrl();
const DEFAULT_TITLE = 'PaceMakers Business Consultants';
const DEFAULT_DESCRIPTION =
  'Boutique corporate finance and transaction advisory firm serving KSA, GCC, and worldwide mandates.';
const DEFAULT_OG_PATH = ogImageFor({
  title: 'Advisory from Structure to Exit',
  subtitle: DEFAULT_DESCRIPTION,
});
const DEFAULT_OG_URL = `${BASE}${DEFAULT_OG_PATH}`;

export const metadata: Metadata = {
  metadataBase: new URL(BASE),
  title: {
    default: DEFAULT_TITLE,
    template: '%s | PaceMakers Business Consultants',
  },
  description: DEFAULT_DESCRIPTION,
  applicationName: DEFAULT_TITLE,
  openGraph: {
    type: 'website',
    siteName: DEFAULT_TITLE,
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    url: BASE,
    images: [{ url: DEFAULT_OG_URL, width: 1200, height: 630, alt: DEFAULT_TITLE }],
  },
  twitter: {
    card: 'summary_large_image',
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    images: [DEFAULT_OG_URL],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${sourceSerif.variable}`}>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
