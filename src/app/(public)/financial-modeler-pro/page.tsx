import type { Metadata } from 'next';

import { fetchPage, fetchPageSections } from '@/lib/cms/pages';
import { FirmPageBody } from '@/components/public/FirmPageBody';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const page = await fetchPage('financial-modeler-pro');
  if (!page) return { title: 'Financial Modeler Pro' };
  const title = page.meta_title ?? page.title;
  return {
    title: { absolute: title },
    description: page.meta_description ?? undefined,
    openGraph: page.og_image_url ? { images: [page.og_image_url] } : undefined,
  };
}

export default async function FinancialModelerProPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const search = await props.searchParams;
  const isPreview = search.preview === '1';

  const sections = await fetchPageSections('financial-modeler-pro', {
    onlyVisible: !isPreview,
  });

  return (
    <FirmPageBody
      sections={sections}
      fallbackHero={{
        eyebrow: 'Financial Modeler Pro',
        headline: 'The platform built by practitioners',
        tagline:
          'PMBC’s flagship platform — a learning environment, model library, and analyst toolkit built from the same engagement experience that drives the advisory practice.',
      }}
    />
  );
}
