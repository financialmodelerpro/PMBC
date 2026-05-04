import type { Metadata } from 'next';

import { fetchPage, fetchPageSections } from '@/lib/cms/pages';
import { FirmPageBody } from '@/components/public/FirmPageBody';
import { buildPageMetadata } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const page = await fetchPage('about');
  return buildPageMetadata({
    path: '/about',
    cmsPage: page,
    fallback: {
      title: 'About | PaceMakers Business Consultants',
      description:
        'A boutique corporate finance firm. Senior-led, analytically grounded, commercially focused.',
      ogSubtitle: 'Senior-led, analytically grounded, commercially focused.',
    },
  });
}

export default async function AboutPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const search = await props.searchParams;
  const isPreview = search.preview === '1';

  const sections = await fetchPageSections('about', { onlyVisible: !isPreview });

  return (
    <FirmPageBody
      sections={sections}
      fallbackHero={{
        eyebrow: 'About',
        headline: 'Senior-led, analytically grounded, commercially focused',
        tagline:
          'PaceMakers is a boutique by design. Every mandate is led by a partner who has personally underwritten transactions on the buy-side, sell-side, and lender-side.',
      }}
    />
  );
}
