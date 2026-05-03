import type { Metadata } from 'next';

import { fetchPage, fetchPageSections } from '@/lib/cms/pages';
import { FirmPageBody } from '@/components/public/FirmPageBody';
import { buildPageMetadata } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const page = await fetchPage('network');
  return buildPageMetadata({
    path: '/network',
    cmsPage: page,
    fallback: {
      title: 'Strategic Network — PaceMakers Business Consultants',
      description:
        'Sky Gulf in Al Khobar and Lynkers in Manama extend our GCC reach.',
      ogSubtitle: 'Reach extended through partners we trust.',
    },
  });
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
