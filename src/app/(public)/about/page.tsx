import type { Metadata } from 'next';

import Link from 'next/link';

import { fetchPage, fetchPageSections } from '@/lib/cms/pages';
import { fetchVisibleTeam, fetchApprovedTestimonials } from '@/lib/cms/collections';
import { FirmPageBody } from '@/components/public/FirmPageBody';
import { TestimonialsBlock } from '@/components/public/TestimonialsBlock';
import { buildPageMetadata } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const page = await fetchPage('about');
  return buildPageMetadata({
    path: '/about',
    cmsPage: page,
    fallback: {
      title: 'About | PaceMakers Business Consultants',
      description:
        'A boutique corporate finance firm. Senior-led, analytically grounded, commercially focused.',
      ogSubtitle: 'Senior-led, analytically grounded, commercially focused.',
    },
  });
}

export default async function AboutPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const search = await props.searchParams;
  const isPreview = search.preview === '1';

  const [sections, team, testimonials] = await Promise.all([
    fetchPageSections('about', { onlyVisible: !isPreview }),
    fetchVisibleTeam(),
    fetchApprovedTestimonials(),
  ]);

  return (
    <>
      <FirmPageBody
        sections={sections}
        fallbackHero={{
          eyebrow: 'About',
          headline: 'Senior-led, analytically grounded, commercially focused',
          tagline:
            'PaceMakers is a boutique by design. Every mandate is led by a partner who has personally underwritten transactions on the buy-side, sell-side, and lender-side.',
        }}
      />

      {team.length > 0 && (
        <section className="bg-[color:var(--pmbc-surface-cream)] px-6 py-20 lg:py-28">
          <div className="mx-auto max-w-[1100px]">
            <div className="mx-auto max-w-2xl text-center">
              <div aria-hidden className="mx-auto h-px w-[60px] bg-[color:var(--pmbc-accent-muted)]" />
              <p
                className="mt-5 text-[11px] font-semibold uppercase text-[color:var(--pmbc-accent-muted)]"
                style={{ letterSpacing: '0.18em' }}
              >
                Team & Advisors
              </p>
              <h2 className="pmbc-display mt-4 text-[32px] leading-[1.12] sm:text-[40px]">
                The people behind the work
              </h2>
            </div>
            <ul className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {team.slice(0, 6).map((m) => (
                <li key={m.id} className="flex flex-col rounded-[2px] border border-[color:var(--pmbc-border-warm)] bg-white p-7">
                  <div className="mb-5 h-36 w-full overflow-hidden rounded-[2px]" style={{ background: '#102E4C' }}>
                    {m.photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.photo} alt={m.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <span className="font-serif text-3xl text-[#D4A93A]">
                          {m.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}
                        </span>
                      </div>
                    )}
                  </div>
                  <h3 className="font-serif text-[19px] font-semibold text-[color:var(--pmbc-text)]">{m.name}</h3>
                  {m.role && <p className="mt-1 text-[14px] text-[color:var(--pmbc-accent-muted)]">{m.role}</p>}
                </li>
              ))}
            </ul>
            <div className="mt-10 text-center">
              <Link
                href="/team"
                className="inline-flex items-center text-[13px] font-semibold uppercase text-[color:var(--pmbc-primary)]"
                style={{ letterSpacing: '0.1em' }}
              >
                Meet the full team
              </Link>
            </div>
          </div>
        </section>
      )}

      <TestimonialsBlock testimonials={testimonials} />
    </>
  );
}
