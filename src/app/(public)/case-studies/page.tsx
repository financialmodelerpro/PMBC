import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';

import { fetchPublishedCaseStudies } from '@/lib/cms/collections';
import { buildPageMetadata } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return buildPageMetadata({
    path: '/case-studies',
    cmsPage: null,
    fallback: {
      title: 'Case Studies | PaceMakers Business Consultants',
      description:
        'Selected engagements across sectors. Anonymized where client confidentiality requires.',
      ogSubtitle: 'Proof of work, discreetly told.',
    },
  });
}

export default async function CaseStudiesPage() {
  const studies = await fetchPublishedCaseStudies();

  return (
    <main>
      {/* Hero */}
      <section
        className="px-6 pt-28 pb-16 text-white sm:pt-32"
        style={{
          background:
            'radial-gradient(ellipse at 50% 30%, #173E63 0%, #102E4C 55%, #0C2741 100%)',
        }}
      >
        <div className="mx-auto max-w-[860px] text-center">
          <div aria-hidden className="mx-auto h-px w-[60px]" style={{ background: '#D4A93A' }} />
          <p
            className="mt-5 text-[11px] font-semibold uppercase"
            style={{ letterSpacing: '0.18em', color: '#D4A93A' }}
          >
            Case Studies
          </p>
          <h1 className="pmbc-display mt-4 text-[40px] leading-[1.1] sm:text-[52px]">
            Proof of work, discreetly told
          </h1>
          <p className="mx-auto mt-5 max-w-[620px] text-[17px] leading-[1.7]" style={{ color: '#E8DDC4' }}>
            Selected engagements across the sectors we serve. Some are anonymized where client
            confidentiality requires.
          </p>
        </div>
      </section>

      {/* Grid */}
      <section className="bg-[color:var(--pmbc-surface-cream)] px-6 py-20 lg:py-28">
        <div className="mx-auto max-w-[1200px]">
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
                      <div className="h-44 w-full" style={{ background: '#102E4C' }} />
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
