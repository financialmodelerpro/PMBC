import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { fetchPage, fetchPageSections } from '@/lib/cms/pages';
import { SectionList } from '@/components/public/SectionRenderer';
import { heroContacts } from '@/components/public/sections/FounderHero';
import { buildPageMetadata, siteUrl } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

const PAGE_SLUG = 'about-muhammad-shahjahan';
const PATH = '/team/muhammad-shahjahan';

const FALLBACK_TITLE = 'Muhammad Shahjahan, ACMA | Senior Associate, Corporate Finance | PaceMakers';
const FALLBACK_DESCRIPTION =
  'Muhammad Shahjahan, ACMA is a Senior Associate in Corporate Finance at PaceMakers Business Consultants, working on valuations, M&A, transaction structuring, corporate restructuring and fundraising.';

export async function generateMetadata(): Promise<Metadata> {
  const page = await fetchPage(PAGE_SLUG);
  return buildPageMetadata({
    path: PATH,
    cmsPage: page,
    fallback: {
      title: FALLBACK_TITLE,
      description: FALLBACK_DESCRIPTION,
      ogSubtitle: 'Senior Associate, Corporate Finance',
    },
  });
}

/**
 * Person schema for the profile, built from literals as Kaleem Farooq's is,
 * with the hero's contact row read from the section so a cleared field leaves
 * the schema too. `<` is escaped so nothing can close the script tag.
 */
function personJsonLd(contacts: ReturnType<typeof heroContacts>) {
  const base = siteUrl();
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    '@id': `${base}${PATH}#person`,
    name: 'Muhammad Shahjahan',
    honorificSuffix: 'ACMA',
    jobTitle: 'Senior Associate, Corporate Finance',
    url: `${base}${PATH}`,
    worksFor: { '@id': `${base}#organization` },
    knowsAbout: [
      'Financial Modeling',
      'Business Valuation',
      'M&A Advisory',
      'Transaction Structuring',
      'Corporate Restructuring',
      'Fundraising',
      'Feasibility Studies',
    ],
    ...(contacts.email ? { email: `mailto:${contacts.email}` } : {}),
    ...(contacts.dial ? { telephone: contacts.dial } : {}),
    ...(contacts.linkedin ? { sameAs: [contacts.linkedin] } : {}),
  };
}

/**
 * Muhammad Shahjahan's full profile. Same shape as /team/kaleem-farooq: every
 * block is a page-builder section (seeded by migration 107), and the page 404s
 * until the seed has run rather than serving an empty shell.
 */
export default async function MuhammadShahjahanProfilePage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const search = await props.searchParams;
  const isPreview = search.preview === '1';

  const sections = await fetchPageSections(PAGE_SLUG, { onlyVisible: !isPreview });
  if (sections.length === 0) notFound();

  const hero = sections.find((s) => s.section_type === 'founder_hero' && s.visible);
  const contacts = heroContacts((hero?.content ?? {}) as Record<string, unknown>);
  const jsonLd = JSON.stringify(personJsonLd(contacts)).replace(/</g, '\\u003c');

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      <SectionList sections={sections} />
    </>
  );
}
