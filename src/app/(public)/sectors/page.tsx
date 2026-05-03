import type { Metadata } from 'next';

import { fetchPage, fetchPageSections } from '@/lib/cms/pages';
import { FirmPageBody } from '@/components/public/FirmPageBody';
import { buildPageMetadata } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const page = await fetchPage('sectors');
  return buildPageMetadata({
    path: '/sectors',
    cmsPage: page,
    fallback: {
      title: 'Sector Coverage — PaceMakers Business Consultants',
      description:
        'Real estate, energy, industrial services, infrastructure, and family-office mandates.',
      ogSubtitle: 'Where we deliver depth, not breadth.',
    },
  });
}

export default async function SectorsPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const search = await props.searchParams;
  const isPreview = search.preview === '1';

  const sections = await fetchPageSections('sectors', { onlyVisible: !isPreview });

  return (
    <FirmPageBody
      sections={sections}
      fallbackHero={{
        eyebrow: 'Sector Coverage',
        headline: 'Where we deliver depth, not breadth',
        tagline:
          'Real estate, energy, industrial services, infrastructure, healthcare, and family-office portfolios across KSA, the GCC, and worldwide mandates.',
      }}
    />
  );
}
