import type { Metadata } from 'next';

import { fetchPage, fetchPageSections } from '@/lib/cms/pages';
import { FirmPageBody } from '@/components/public/FirmPageBody';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const page = await fetchPage('network');
  if (!page) return { title: 'Strategic Network' };
  const title = page.meta_title ?? page.title;
  return {
    title: { absolute: title },
    description: page.meta_description ?? undefined,
    openGraph: page.og_image_url ? { images: [page.og_image_url] } : undefined,
  };
}

export default async function NetworkPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const search = await props.searchParams;
  const isPreview = search.preview === '1';

  const sections = await fetchPageSections('network', { onlyVisible: !isPreview });

  return (
    <FirmPageBody
      sections={sections}
      fallbackHero={{
        eyebrow: 'Strategic Network',
        headline: 'Reach extended through partners we trust',
        tagline:
          'Sky Gulf in Al Khobar. Lynkers in Manama. Long-standing relationships that extend our mandates across KSA, Bahrain, and the broader Gulf banking network.',
      }}
    />
  );
}
