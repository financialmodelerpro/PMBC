import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

import { fetchPage } from '@/lib/cms/pages';
import { fetchServiceDetailFields, findService } from '@/lib/cms/serviceContent';
import { SERVICES } from '@/config/services';
import { ServiceDetail } from '@/components/public/sections/ServiceDetail';
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
}) {
  const { slug } = await props.params;
  const service = findService(slug);
  if (!service) notFound();

  const fields = await fetchServiceDetailFields(slug);
  const canonical = `${siteUrl()}/services/${slug}`;

  return (
    <>
      <ServiceJsonLd
        slug={service.slug}
        name={service.title}
        description={service.summary}
        url={canonical}
      />
      <ServiceDetail
        content={{
          service_slug: service.slug,
          full_description_html: fields.full_description_html,
          deliverables: fields.deliverables,
          timeline_text: fields.timeline_text,
          target_audience_text: fields.target_audience_text,
        }}
        styles={{}}
        variant="white"
      />

      {/* CTA — links to /contact with the service pre-selected. */}
      <section
        className="px-6 py-24 text-white sm:py-28 lg:py-32"
        style={{
          background:
            'radial-gradient(ellipse at 50% 40%, #173E63 0%, #102E4C 55%, #0C2741 100%)',
        }}
      >
        <div className="mx-auto flex max-w-[860px] flex-col items-center text-center">
          <div
            aria-hidden
            className="h-px w-[60px]"
            style={{ background: '#D4A93A' }}
          />
          <p
            className="mt-5 text-[11px] font-semibold uppercase"
            style={{ letterSpacing: '0.18em', color: '#D4A93A' }}
          >
            Engage PMBC
          </p>
          <h2 className="pmbc-display mt-5 text-[36px] leading-[1.12] sm:text-[44px] lg:text-[52px]">
            Discuss a {service.title.toLowerCase()} mandate
          </h2>
          <p
            className="mx-auto mt-5 max-w-[640px] text-[17px] leading-[1.7] sm:text-[18px]"
            style={{ color: '#E8DDC4' }}
          >
            Tell us about the engagement. We respond to every credible enquiry within
            one to two business days.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              href={`/contact?service=${service.slug}`}
              className="inline-flex items-center gap-2 border border-[#D4A93A] px-8 py-3.5 text-[12px] font-semibold uppercase text-[#E8DDC4] transition-all duration-200 hover:bg-[#D4A93A] hover:text-[#0F2F4F]"
              style={{ letterSpacing: '0.12em' }}
            >
              Start a conversation
              <ArrowRight size={14} />
            </Link>
            <Link
              href="/services"
              className="inline-flex items-center px-8 py-3.5 text-[12px] font-semibold uppercase transition-colors duration-200"
              style={{
                letterSpacing: '0.12em',
                border: '1px solid rgba(232, 221, 196, 0.3)',
                color: '#E8DDC4',
              }}
            >
              See all services
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
