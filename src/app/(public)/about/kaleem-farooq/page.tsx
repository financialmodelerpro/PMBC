import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { fetchPage, fetchPageSections } from '@/lib/cms/pages';
import { SectionList } from '@/components/public/SectionRenderer';
import { buildPageMetadata, siteUrl } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

const PAGE_SLUG = 'about-kaleem-farooq';
const PATH = '/about/kaleem-farooq';

const FALLBACK_TITLE = 'Kaleem Farooq | Business Development, Saudi Arabia | PaceMakers';
const FALLBACK_DESCRIPTION =
  'Kaleem Farooq leads business development for PaceMakers Business Consultants in Saudi Arabia. Finance and commercial leader with 12+ years in the Kingdom across technology, SaaS, construction, government projects and fintech.';

export async function generateMetadata(): Promise<Metadata> {
  const page = await fetchPage(PAGE_SLUG);
  return buildPageMetadata({
    path: PATH,
    cmsPage: page,
    fallback: {
      title: FALLBACK_TITLE,
      description: FALLBACK_DESCRIPTION,
      ogSubtitle: 'Business Development, Saudi Arabia',
    },
  });
}

/**
 * Person schema for the profile, built from literals for the same reason as the
 * founder's: nothing user-supplied reaches the script tag. Linked to the
 * Organization node the public layout mounts.
 */
function personJsonLd() {
  const base = siteUrl();
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    '@id': `${base}${PATH}#person`,
    name: 'Kaleem Farooq',
    jobTitle: 'Business Development, Saudi Arabia',
    url: `${base}${PATH}`,
    worksFor: { '@id': `${base}#organization` },
    workLocation: { '@type': 'Place', name: 'Riyadh, Saudi Arabia' },
    knowsAbout: [
      'Business Development',
      'Bid Strategy',
      'Fundraising and Investor Readiness',
      'Financial Modelling',
      'Treasury and Banking',
      'Cost Optimisation',
      'Regulatory, Tax and Governance',
    ],
  };
}

/**
 * Kaleem Farooq's full profile. Same shape as /about/ahmad-din: every block is a
 * page-builder section (seeded by migration 098), and the page 404s until the
 * seed has run rather than serving an empty shell.
 */
export default async function KaleemFarooqProfilePage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const search = await props.searchParams;
  const isPreview = search.preview === '1';

  const sections = await fetchPageSections(PAGE_SLUG, { onlyVisible: !isPreview });
  if (sections.length === 0) notFound();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(personJsonLd()) }}
      />
      <SectionList sections={sections} />
    </>
  );
}
