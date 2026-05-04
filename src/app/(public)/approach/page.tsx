import type { Metadata } from 'next';

import { fetchPage, fetchPageSections } from '@/lib/cms/pages';
import { FirmPageBody } from '@/components/public/FirmPageBody';
import { buildPageMetadata } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const page = await fetchPage('approach');
  return buildPageMetadata({
    path: '/approach',
    cmsPage: page,
    fallback: {
      title: 'Engagement Approach | PaceMakers Business Consultants',
      description: 'How we engage: understand, analyse, model, advise.',
      ogSubtitle: 'Understand. Analyse. Model. Advise.',
    },
  });
}

export default async function ApproachPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const search = await props.searchParams;
  const isPreview = search.preview === '1';

  const sections = await fetchPageSections('approach', { onlyVisible: !isPreview });

  return (
    <FirmPageBody
      sections={sections}
      fallbackHero={{
        eyebrow: 'Our Approach',
        headline: 'How we engage',
        tagline:
          'Understand. Analyse. Model. Advise. Senior-led from first call to final advice. No black-box deliverables, no junior pass-throughs.',
      }}
    />
  );
}
