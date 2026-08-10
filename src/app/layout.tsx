import type { Metadata } from 'next';
import { Inter, Source_Serif_4 } from 'next/font/google';
import './globals.css';

import { ogImageFor, siteUrl } from '@/lib/seo/metadata';
import { faviconMimeType, resolveFaviconUrl } from '@/lib/cms/favicon';

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

/**
 * Async so the browser-tab icon can come from the CMS.
 *
 * `metadata` was a static object, which is why the Favicon field in admin did
 * nothing: there was no `icons` key anywhere and no code path that read
 * `branding_config`. Child pages set their own title, description and OG image
 * through `buildPageMetadata` but never set `icons`, so what is resolved here
 * propagates to every page.
 *
 * `resolveFaviconUrl` cannot throw, which matters more here than anywhere else:
 * this function runs for every page in the app, including at build time, so an
 * error would take down metadata generation site-wide rather than lose an icon.
 */
export async function generateMetadata(): Promise<Metadata> {
  const faviconUrl = await resolveFaviconUrl();

  // Omitted entirely rather than set to a placeholder when nothing is
  // configured. An empty or broken href is worse than no link: browsers then
  // request it, fail, and some cache the failure.
  const icons: Metadata['icons'] | undefined = faviconUrl
    ? {
        icon: [{ url: faviconUrl, type: faviconMimeType(faviconUrl) }],
        shortcut: [{ url: faviconUrl }],
        apple: [{ url: faviconUrl }],
      }
    : undefined;

  return {
  metadataBase: new URL(BASE),
  title: {
    default: DEFAULT_TITLE,
    template: '%s | PaceMakers Business Consultants',
  },
  description: DEFAULT_DESCRIPTION,
  applicationName: DEFAULT_TITLE,
  icons,
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
}

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
