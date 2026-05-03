import type { Metadata } from 'next';

import { fetchPage, fetchPageSections } from '@/lib/cms/pages';
import { FirmPageBody } from '@/components/public/FirmPageBody';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const page = await fetchPage('about');
  if (!page) return { title: 'About' };
  const title = page.meta_title ?? page.title;
  return {
    title: { absolute: title },
    description: page.meta_description ?? undefined,
    openGraph: page.og_image_url ? { images: [page.og_image_url] } : undefined,
  };
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
