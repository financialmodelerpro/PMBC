import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

import { fetchPage } from '@/lib/cms/pages';
import { fetchServiceDetailFields, findService } from '@/lib/cms/serviceContent';
import { SERVICES } from '@/config/services';
import { ServiceDetail } from '@/components/public/sections/ServiceDetail';

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
  const title =
    page?.meta_title ?? `${service.title} — PaceMakers Business Consultants`;
  return {
    title: { absolute: title },
    description: page?.meta_description ?? service.summary,
    openGraph: page?.og_image_url ? { images: [page.og_image_url] } : undefined,
  };
}

export default async function ServiceDetailPage(props: {
  params: Promise<Params>;
}) {
  const { slug } = await props.params;
  const service = findService(slug);
  if (!service) notFound();

  const fields = await fetchServiceDetailFields(slug);

  return (
    <>
      <ServiceDetail
        content={{
          service_slug: service.slug,
          full_description_html: fields.full_description_html,
          deliverables: fields.deliverables,
          timeline_text: fields.timeline_text,
          target_audience_text: fields.target_audience_text,
        }}
      />

      {/* CTA — links to /contact with the service pre-selected. */}
      <section className="bg-[#0F2540] px-6 py-20 text-white lg:py-24">
        <div className="mx-auto flex max-w-4xl flex-col items-center text-center">
          <p className="text-[11px] font-semibold tracking-[0.22em] uppercase text-[#D4A93A]">
            Engage PMBC
          </p>
          <h2 className="mt-3 font-serif text-3xl font-semibold tracking-tight sm:text-4xl">
            Discuss a {service.title.toLowerCase()} mandate
          </h2>
          <p className="mt-4 max-w-2xl text-base text-[#E8EEF5]/80 sm:text-lg">
            Tell us about the engagement. We respond to every credible enquiry within
            one to two business days.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href={`/contact?service=${service.slug}`}
              className="inline-flex items-center gap-1.5 rounded-md bg-white px-5 py-2.5 text-sm font-semibold text-[#0F2540] transition hover:bg-[#E8EEF5]"
            >
              Start a conversation
              <ArrowRight size={14} />
            </Link>
            <Link
              href="/services"
              className="inline-flex items-center rounded-md border border-white/30 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-white/5"
            >
              See all services
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
