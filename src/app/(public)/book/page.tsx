import type { Metadata } from 'next';

import { fetchPage, fetchPageSections } from '@/lib/cms/pages';
import { fetchSiteSettings } from '@/lib/cms/settings';
import { FirmPageBody } from '@/components/public/FirmPageBody';
import { BookingBody } from '@/components/public/sections/BookingBody';
import { buildPageMetadata } from '@/lib/seo/metadata';
import type { SectionContext } from '@/lib/public/sectionContext';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const page = await fetchPage('book');
  return buildPageMetadata({
    path: '/book',
    cmsPage: page,
    fallback: {
      title: 'Book a Meeting | PaceMakers Business Consultants',
      description:
        'Book an introductory call with PaceMakers Business Consultants. No cost, no obligation, and a direct conversation about your mandate.',
      ogSubtitle: 'Start the conversation.',
    },
  });
}

export default async function BookPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const search = await props.searchParams;
  const isPreview = search.preview === '1';

  const [sections, settings] = await Promise.all([
    fetchPageSections('book', { onlyVisible: !isPreview }),
    safe(fetchSiteSettings(), {}),
  ]);

  // Everything this page says is now section content, edited in the page
  // builder (migration 066). The calendar URL is not copy: it is admin-editable
  // in Site Settings so it can be repointed without a deploy, and empty is a
  // supported state that leads with the direct contact routes instead.
  const context: SectionContext = {
    settings,
    bookingUrl: (settings.booking_url ?? '').trim(),
  };

  // A database that has not run migration 066 has no `booking_body` row. Same
  // reasoning as the fallback hero below it: never serve the page with a hole.
  const hasBody = sections.some((s) => s.section_type === 'booking_body');

  return (
    <>
      <FirmPageBody
        sections={sections}
        context={context}
        fallbackHero={{
          eyebrow: 'Book a Meeting',
          headline: 'Start the conversation.',
          tagline:
            'An introductory call at no cost and no obligation. We will discuss the mandate, the timeline, and whether PaceMakers is the right firm for it.',
        }}
      />
      {!hasBody && <BookingBody content={{}} variant="cream" context={context} />}
    </>
  );
}

async function safe<T>(p: Promise<T>, fallback: T): Promise<T> {
  try {
    return await p;
  } catch {
    return fallback;
  }
}
