import type { Metadata } from 'next';

import { fetchPage, fetchPageSections } from '@/lib/cms/pages';
import { FirmPageBody } from '@/components/public/FirmPageBody';
import { buildPageMetadata } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const page = await fetchPage('financial-modeler-pro');
  return buildPageMetadata({
    path: '/financial-modeler-pro',
    cmsPage: page,
    fallback: {
      title: 'Financial Modeler Pro — PaceMakers Business Consultants',
      description:
        "PMBC's flagship platform for financial modeling education and tools.",
      ogSubtitle: 'The platform built by practitioners.',
    },
  });
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
