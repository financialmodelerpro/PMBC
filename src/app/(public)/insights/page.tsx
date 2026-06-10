import type { Metadata } from 'next';
import Link from 'next/link';

import { fetchPublishedArticles } from '@/lib/cms/collections';
import { buildPageMetadata } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return buildPageMetadata({
    path: '/insights',
    cmsPage: null,
    fallback: {
      title: 'Insights | PaceMakers Business Consultants',
      description:
        'Perspectives on valuation, transactions, and corporate finance from the PaceMakers team.',
      ogSubtitle: 'Perspectives on corporate finance.',
    },
  });
}

function fmtDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
}

export default async function InsightsPage() {
  const articles = await fetchPublishedArticles();
  const [lead, ...rest] = articles;

  return (
    <main>
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
            Insights
          </p>
          <h1 className="pmbc-display mt-4 text-[40px] leading-[1.1] sm:text-[52px]">
            Perspectives on the work
          </h1>
          <p className="mx-auto mt-5 max-w-[620px] text-[17px] leading-[1.7]" style={{ color: '#E8DDC4' }}>
            Notes on valuation, transactions, and corporate finance from the people doing the
            modelling.
          </p>
        </div>
      </section>

      <section className="bg-[color:var(--pmbc-surface-cream)] px-6 py-20 lg:py-28">
        <div className="mx-auto max-w-[1100px]">
          {articles.length === 0 ? (
            <p className="text-center text-[16px] text-[color:var(--pmbc-muted)]">
              Articles are being prepared and will appear here shortly.
            </p>
          ) : (
            <>
              {lead && (
                <Link
                  href={`/insights/${lead.slug}`}
                  className="group mb-12 grid overflow-hidden rounded-[2px] border border-[color:var(--pmbc-border-warm)] bg-white md:grid-cols-2"
                >
                  <div className="h-56 w-full md:h-full" style={{ background: '#102E4C' }}>
                    {lead.cover_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={lead.cover_url} alt="" className="h-full w-full object-cover" />
                    )}
                  </div>
                  <div className="flex flex-col justify-center p-9">
                    {lead.category && (
                      <span className="text-[11px] font-semibold uppercase text-[color:var(--pmbc-accent-muted)]" style={{ letterSpacing: '0.14em' }}>
                        {lead.category}
                      </span>
                    )}
                    <h2 className="mt-3 font-serif text-[28px] font-semibold leading-tight text-[color:var(--pmbc-text)]">
                      {lead.title}
                    </h2>
                    {lead.excerpt && (
                      <p className="mt-3 text-[15px] leading-[1.7] text-[color:var(--pmbc-muted)]">{lead.excerpt}</p>
                    )}
                    <p className="mt-5 text-[12px] uppercase text-[color:var(--pmbc-muted)]" style={{ letterSpacing: '0.08em' }}>
                      {fmtDate(lead.published_at)}
                    </p>
                  </div>
                </Link>
              )}

              {rest.length > 0 && (
                <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {rest.map((a) => (
                    <li key={a.id}>
                      <Link
                        href={`/insights/${a.slug}`}
                        className="group flex h-full flex-col overflow-hidden rounded-[2px] border border-[color:var(--pmbc-border-warm)] bg-white transition hover:-translate-y-0.5 hover:shadow-[0_12px_36px_rgba(15,37,64,0.08)]"
                      >
                        <div className="h-40 w-full" style={{ background: '#102E4C' }}>
                          {a.cover_url && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={a.cover_url} alt="" className="h-full w-full object-cover" />
                          )}
                        </div>
                        <div className="flex flex-1 flex-col p-7">
                          {a.category && (
                            <span className="text-[11px] font-semibold uppercase text-[color:var(--pmbc-accent-muted)]" style={{ letterSpacing: '0.14em' }}>
                              {a.category}
                            </span>
                          )}
                          <h3 className="mt-3 font-serif text-[19px] font-semibold leading-tight text-[color:var(--pmbc-text)]">
                            {a.title}
                          </h3>
                          {a.excerpt && (
                            <p className="mt-3 flex-1 text-[14px] leading-[1.7] text-[color:var(--pmbc-muted)]">{a.excerpt}</p>
                          )}
                          <p className="mt-5 text-[12px] uppercase text-[color:var(--pmbc-muted)]" style={{ letterSpacing: '0.08em' }}>
                            {fmtDate(a.published_at)}
                          </p>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </section>
    </main>
  );
}
