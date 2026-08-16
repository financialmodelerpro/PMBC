import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';

import { fetchPublishedCaseStudies } from '@/lib/cms/collections';
import { buildPageMetadata } from '@/lib/seo/metadata';
import { fetchPage, fetchPageSections } from '@/lib/cms/pages';
import { FirmPageBody } from '@/components/public/FirmPageBody';

export const dynamic = 'force-dynamic';

/** The hero copy this page ships with, and its fallback when no section exists. */
const FALLBACK_HERO = {
  eyebrow: 'Case Studies',
  headline: 'Proof of work, discreetly told',
  tagline:
    'Selected engagements across the sectors we serve. Some are anonymized where client confidentiality requires.',
};

export async function generateMetadata(): Promise<Metadata> {
  return buildPageMetadata({
    path: '/case-studies',
    cmsPage: await fetchPage('case-studies'),
    fallback: {
      title: 'Case Studies | PaceMakers Business Consultants',
      description:
        'Selected engagements across sectors. Anonymized where client confidentiality requires.',
      ogSubtitle: 'Proof of work, discreetly told.',
    },
  });
}

export default async function CaseStudiesPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const search = await props.searchParams;
  const isPreview = search.preview === '1';

  const [studies, sections] = await Promise.all([
    fetchPublishedCaseStudies(),
    fetchPageSections('case-studies', { onlyVisible: !isPreview }),
  ]);

  return (
    <main>
      {/* The hero is a CMS section since migration 070, so its three strings are
          edited in the page builder like every other page's, with the shipped
          copy kept as a fallback for a database without that section. The cards
          below come from the `case_studies` collection. */}
      <FirmPageBody sections={sections} fallbackHero={FALLBACK_HERO} />

      {/* Grid */}
      <section className="bg-[color:var(--pmbc-surface-cream)] px-6 py-20 lg:py-28">
        {/* See the note on /team: the count is for the sitemap verification. */}
        <div className="mx-auto max-w-[1200px]" data-collection-count={studies.length}>
          {studies.length === 0 ? (
            <p className="text-center text-[16px] text-[color:var(--pmbc-muted)]">
              Case studies are being prepared and will appear here shortly.
            </p>
          ) : (
            <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {studies.map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/case-studies/${s.slug}`}
                    className="group flex h-full flex-col overflow-hidden rounded-[2px] border border-[color:var(--pmbc-border-warm)] bg-white transition hover:-translate-y-0.5 hover:shadow-[0_12px_36px_rgba(15,37,64,0.08)]"
                  >
                    {s.cover_image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={s.cover_image} alt="" className="h-44 w-full object-cover" />
                    ) : (
                      <div className="h-44 w-full" style={{ background: '#1B3A5F' }} />
                    )}
                    <div className="flex flex-1 flex-col p-7">
                      {s.industry && (
                        <span
                          className="text-[11px] font-semibold uppercase text-[color:var(--pmbc-accent-muted)]"
                          style={{ letterSpacing: '0.14em' }}
                        >
                          {s.industry}
                        </span>
                      )}
                      <h2 className="mt-3 font-serif text-[21px] font-semibold leading-tight text-[color:var(--pmbc-text)]">
                        {s.title}
                      </h2>
                      {s.summary && (
                        <p className="mt-3 flex-1 text-[15px] leading-[1.7] text-[color:var(--pmbc-muted)]">
                          {s.summary}
                        </p>
                      )}
                      <span className="mt-5 inline-flex items-center gap-1 text-[13px] font-semibold text-[color:var(--pmbc-primary)]">
                        Read the engagement
                        <ArrowUpRight size={14} className="transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </main>
  );
}
