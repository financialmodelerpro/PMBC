import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowUpRight } from 'lucide-react';

import { fetchPage, fetchPageSections } from '@/lib/cms/pages';
import { SectionRenderer } from '@/components/public/SectionRenderer';
import { SERVICES } from '@/config/services';
import { buildPageMetadata } from '@/lib/seo/metadata';

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

  const sections = await fetchPageSections('services', { onlyVisible: !isPreview });

  return (
    <>
      {sections.map((s) => (
        <SectionRenderer key={s.id} section={s} />
      ))}

      <section className="bg-white px-6 py-24 lg:py-32">
        <div className="mx-auto max-w-[1200px]">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-[color:var(--pmbc-primary)]">
              Practice Areas
            </p>
            <h2 className="mt-4 font-serif text-3xl font-semibold tracking-tight text-[color:var(--pmbc-text)] sm:text-4xl">
              Nine disciplines, one standard of work
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-[color:var(--pmbc-muted)]">
              Each engagement is led directly by the partner, modelled to institutional
              standards, and delivered with the documentation a board, lender, or
              investor will accept without rework.
            </p>
          </div>

          <ul className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {SERVICES.map((s) => (
              <li key={s.slug}>
                <Link
                  href={`/services/${s.slug}`}
                  className="group flex h-full flex-col rounded-lg border border-[color:var(--pmbc-border)] bg-white p-7 transition hover:-translate-y-0.5 hover:border-[color:var(--pmbc-primary)] hover:shadow-[0_8px_30px_rgba(15,37,64,0.08)]"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-serif text-sm font-semibold text-[color:var(--pmbc-accent)]">
                      {s.number}
                    </span>
                    <ArrowUpRight
                      size={16}
                      className="text-[color:var(--pmbc-muted)] transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-[color:var(--pmbc-primary)]"
                    />
                  </div>
                  <h3 className="mt-5 font-serif text-xl font-semibold text-[color:var(--pmbc-text)]">
                    {s.title}
                  </h3>
                  <p className="mt-3 text-[13.5px] leading-relaxed text-[color:var(--pmbc-muted)]">
                    {s.summary}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
