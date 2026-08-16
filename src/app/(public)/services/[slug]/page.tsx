import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

import { fetchPage, fetchPageSections } from '@/lib/cms/pages';
import { fetchServiceDetailFields, findService } from '@/lib/cms/serviceContent';
import { SERVICES } from '@/config/services';
import { ServiceDetail } from '@/components/public/sections/ServiceDetail';
import { SectionList } from '@/components/public/SectionRenderer';
import { PageHeroFallback } from '@/components/public/PageHeroFallback';
import { PAGE_GUTTER, SECTION_PADDING } from '@/lib/public/layout';
import { withIndefiniteArticle } from '@/lib/public/grammar';
import { buildPageMetadata, siteUrl } from '@/lib/seo/metadata';
import { ServiceJsonLd } from '@/components/seo/ServiceJsonLd';

export const dynamic = 'force-dynamic';

type Params = { slug: string };

export function generateStaticParams(): Params[] {
  return SERVICES.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata(props: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await props.params;
  const service = findService(slug);
  if (!service) return { title: 'Service' };

  // cms_pages row keyed `service-{slug}` carries the meta_title and
  // meta_description for each detail page (seeded by migration 005).
  const page = await fetchPage(`service-${slug}`);
  return buildPageMetadata({
    path: `/services/${slug}`,
    cmsPage: page,
    fallback: {
      title: `${service.title} | PaceMakers Business Consultants`,
      description: service.summary,
      ogSubtitle: service.summary,
    },
    ogSubtitleOverride: service.summary,
  });
}

export default async function ServiceDetailPage(props: {
  params: Promise<Params>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await props.params;
  const search = await props.searchParams;
  const isPreview = search.preview === '1';
  const service = findService(slug);
  if (!service) notFound();

  // Since migration 067 the body of each service page is a `service_detail`
  // section on its own `service-<slug>` page, edited in the page builder and
  // rendered in the order set there. Sections added after it render after it.
  const sections = await fetchPageSections(`service-${slug}`, {
    onlyVisible: !isPreview,
  });

  // A database that has not run 067 still has the copy in cms_content under
  // `service_<slug>`. Read it only in that case, so the page never goes blank
  // mid-migration, and so this file keeps working against an older snapshot.
  const legacyFields =
    sections.length === 0 ? await fetchServiceDetailFields(slug) : null;

  const canonical = `${siteUrl()}/services/${slug}`;

  return (
    <>
      <ServiceJsonLd
        slug={service.slug}
        name={service.title}
        description={service.summary}
        url={canonical}
      />
      {/* The shared hero, so a service page opens at the same height as every
          other page. The detail block below drops its own number, title and
          summary rather than repeating them. */}
      <PageHeroFallback
        eyebrow={`Service ${service.number}`}
        headline={service.title}
        tagline={service.summary}
      />
      {legacyFields ? (
        <ServiceDetail
          showHeader={false}
          content={{
            service_slug: service.slug,
            full_description_html: legacyFields.full_description_html,
            deliverables: legacyFields.deliverables,
            timeline_text: legacyFields.timeline_text,
            target_audience_text: legacyFields.target_audience_text,
          }}
          styles={{}}
          variant="cream"
          media={legacyFields.media}
        />
      ) : (
        <SectionList sections={sections} />
      )}

      {/* CTA, linking to /contact with the service pre-selected. */}
      <section className={`bg-white ${PAGE_GUTTER} ${SECTION_PADDING}`}>
        <div className="mx-auto flex max-w-[860px] flex-col items-center text-center">
          <div
            aria-hidden
            className="h-px w-[60px]"
            style={{ background: '#C69C3E' }}
          />
          <p
            className="mt-5 text-[11px] font-semibold uppercase"
            style={{ letterSpacing: '0.18em', color: '#A88530' }}
          >
            Engage PaceMakers
          </p>
          {/* The title keeps its own casing, and the article is chosen by the
              sound it starts with rather than the letter. Lowercasing produced
              "Discuss a m&a advisory mandate", and a vowel-letter test would
              still have given "a M&A", since M is said "em". See
              `indefiniteArticle`. */}
          <h2
            className="pmbc-display mt-5 text-[36px] leading-[1.12] sm:text-[44px] lg:text-[52px]"
            style={{ color: '#0F1B2D' }}
          >
            Discuss {withIndefiniteArticle(service.title)} mandate
          </h2>
          <p
            className="mx-auto mt-5 max-w-[640px] text-[17px] leading-[1.7] sm:text-[18px]"
            style={{ color: '#52606B' }}
          >
            Tell us about the engagement.
          </p>
          {/* One call to action. The second was "See all services", which points
              back the way the reader came, and this block's job is to move them
              forward. The `?service=` pre-fill selects this service in the
              contact form's dropdown. */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              href={`/contact?service=${service.slug}`}
              className="inline-flex items-center gap-2 border border-[#1B3A5F] bg-[#1B3A5F] px-8 py-3.5 text-[12px] font-semibold uppercase text-white transition-all duration-200 hover:bg-[#14304F] hover:border-[#C69C3E]"
              style={{ letterSpacing: '0.12em' }}
            >
              Send an Enquiry
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
