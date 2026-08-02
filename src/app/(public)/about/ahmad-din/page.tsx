import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { fetchPage, fetchPageSections } from '@/lib/cms/pages';
import { SectionList } from '@/components/public/SectionRenderer';
import { buildPageMetadata, siteUrl } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

const PAGE_SLUG = 'about-ahmad-din';
const PATH = '/about/ahmad-din';

const FALLBACK_TITLE = 'Ahmad Din | Founder | PaceMakers Business Consultants';
const FALLBACK_DESCRIPTION =
  'Ahmad Din, ACCA Member (UK) and FMVA certified, founder of PaceMakers Business Consultants. Over 12 years in corporate finance and transaction advisory across Saudi Arabia, the GCC, and Pakistan.';

export async function generateMetadata(): Promise<Metadata> {
  const page = await fetchPage(PAGE_SLUG);
  return buildPageMetadata({
    path: PATH,
    cmsPage: page,
    fallback: {
      title: FALLBACK_TITLE,
      description: FALLBACK_DESCRIPTION,
      ogSubtitle: 'Founder, PaceMakers Business Consultants',
    },
  });
}

/**
 * Person schema for the founder profile.
 *
 * Built from literals rather than serialised CMS content, which is why it is
 * exempt from the Phase 6.5 sanitiser rule: nothing user-supplied reaches the
 * script tag. Linked to the Organization node the public layout already mounts,
 * so search engines can connect the founder to the firm.
 */
function personJsonLd() {
  const base = siteUrl();
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    '@id': `${base}${PATH}#person`,
    name: 'Ahmad Din',
    jobTitle: 'Founder and Corporate Finance and Transaction Advisory Specialist',
    url: `${base}${PATH}`,
    // Must match the id minted in OrganizationJsonLd exactly (no slash before
    // the fragment), or the two nodes never join up in the graph.
    worksFor: { '@id': `${base}#organization` },
    knowsAbout: [
      'Financial Modeling',
      'Business Valuation',
      'Transaction Advisory',
      'Financial Due Diligence',
      'Project Finance',
      'Real Estate Development Modeling',
      'Mergers and Acquisitions',
    ],
    hasCredential: ['ACCA Member (UK)', 'FMVA Certified'],
  };
}

export default async function FounderProfilePage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const search = await props.searchParams;
  const isPreview = search.preview === '1';

  const sections = await fetchPageSections(PAGE_SLUG, { onlyVisible: !isPreview });

  // The page is entirely CMS-driven. If the seed has not run there is nothing
  // meaningful to show, and a 404 is more honest than an empty shell that
  // still reports HTTP 200 to a crawler.
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
