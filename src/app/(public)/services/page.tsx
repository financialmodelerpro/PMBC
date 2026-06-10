import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowUpRight } from 'lucide-react';

import { fetchPage, fetchPageSections } from '@/lib/cms/pages';
import { SectionList } from '@/components/public/SectionRenderer';
import { SERVICES } from '@/config/services';
import { fetchPublishedServices } from '@/lib/cms/collections';
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

  // Prefer the managed services collection; fall back to static config so the
  // grid still renders before migration 021 is applied / rows are published.
  const managed = await fetchPublishedServices();
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

  return (
    <>
      <SectionList sections={sections} />

      <section className="bg-[color:var(--pmbc-surface-cream)] px-6 py-24 lg:py-32">
        <div className="mx-auto max-w-[1200px]">
          <div className="mx-auto max-w-2xl text-center">
            <div
              aria-hidden
              className="mx-auto h-px w-[60px] bg-[color:var(--pmbc-accent-muted)]"
            />
            <p
              className="mt-5 text-[11px] font-semibold uppercase text-[color:var(--pmbc-accent-muted)]"
              style={{ letterSpacing: '0.18em' }}
            >
              Practice Areas
            </p>
            <h2 className="pmbc-display mt-4 text-[34px] leading-[1.12] sm:text-[42px] lg:text-[48px]">
              Nine disciplines, one standard of work
            </h2>
            <p className="mt-5 text-[17px] leading-[1.7] text-[#52606B] sm:text-[18px]">
              Each engagement is led directly by the partner, modelled to institutional
              standards, and delivered with the documentation a board, lender, or
              investor will accept without rework.
            </p>
          </div>

          <ul className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map((s) => (
              <li key={s.slug}>
                <Link
                  href={`/services/${s.slug}`}
                  className="group flex h-full flex-col rounded-[2px] border border-t-2 border-[color:var(--pmbc-border-warm)] bg-white p-9 transition hover:-translate-y-0.5 hover:border-[color:var(--pmbc-primary)] hover:shadow-[0_12px_36px_rgba(15,37,64,0.08)]"
                  style={{ borderTopColor: '#D4A93A' }}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-serif text-2xl font-semibold text-[color:var(--pmbc-accent-muted)]">
                      {s.number}
                    </span>
                    <ArrowUpRight
                      size={16}
                      className="text-[color:var(--pmbc-muted)] transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-[color:var(--pmbc-primary)]"
                    />
                  </div>
                  <h3 className="mt-5 font-serif text-[22px] font-semibold leading-tight text-[color:var(--pmbc-text)]">
                    {s.title}
                  </h3>
                  <p className="mt-3 text-[15px] leading-[1.7] text-[color:var(--pmbc-muted)]">
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
