import type { Metadata } from 'next';

import { fetchPage, fetchPageSections } from '@/lib/cms/pages';
import { SectionList } from '@/components/public/SectionRenderer';
import { ServiceGrid } from '@/components/public/sections/ServiceGrid';
import { SERVICES } from '@/config/services';
import { fetchPublishedServices } from '@/lib/cms/collections';
import { buildPageMetadata } from '@/lib/seo/metadata';
import type { SectionContext } from '@/lib/public/sectionContext';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const page = await fetchPage('services');
  return buildPageMetadata({
    path: '/services',
    cmsPage: page,
    fallback: {
      title: 'Services | PaceMakers Business Consultants',
      description:
        'Financial modeling, valuation, due diligence, M&A, and CFO advisory across KSA and GCC mandates.',
      ogSubtitle: 'Nine disciplines, one standard of work.',
    },
  });
}

export default async function ServicesPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const search = await props.searchParams;
  const isPreview = search.preview === '1';

  const [sections, managed] = await Promise.all([
    fetchPageSections('services', { onlyVisible: !isPreview }),
    // Prefer the managed services collection; fall back to static config so the
    // grid still renders before migration 021 is applied / rows are published.
    fetchPublishedServices(),
  ]);

  const cards = managed.length
    ? managed.map((s) => ({
        slug: s.slug,
        number: s.number ?? '',
        title: s.title,
        summary: s.summary ?? '',
      }))
    : SERVICES.map((s) => ({
        slug: s.slug,
        number: s.number,
        title: s.title,
        summary: s.summary,
      }));

  const context: SectionContext = { services: cards };

  // The grid was written into this file and rendered after every CMS section
  // regardless of the order the builder showed, so a cta_block placed after it
  // came out above it. It is a `service_grid` section now (migration 068), which
  // is what makes the builder order the page order.
  const hasGrid = sections.some((s) => s.section_type === 'service_grid');

  return (
    <>
      <SectionList sections={sections} context={context} />
      {/* A database that has not run 068 has no grid row, and /services without
          its nine cards is not a page worth serving. Same fallback reasoning as
          /contact and /book. */}
      {!hasGrid && <ServiceGrid content={{}} variant="white" context={context} />}
    </>
  );
}
