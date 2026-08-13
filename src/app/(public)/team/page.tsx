import type { Metadata } from 'next';
import { ExternalLink, Mail } from 'lucide-react';

import { sanitizeRichHtml } from '@/lib/cms/sanitize';
import { fetchVisibleTeam } from '@/lib/cms/collections';
import { buildPageMetadata } from '@/lib/seo/metadata';
import { PageHeroFallback } from '@/components/public/PageHeroFallback';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return buildPageMetadata({
    path: '/team',
    cmsPage: null,
    fallback: {
      title: 'Team & Advisors | PaceMakers Business Consultants',
      description:
        'The people behind PaceMakers. Senior practitioners who lead every mandate directly.',
      ogSubtitle: 'Senior practitioners, partner-led mandates.',
    },
  });
}

export default async function TeamPage() {
  const team = await fetchVisibleTeam();

  return (
    <main>
      {/* The shared hero, not a fourth hand-rolled copy. This band was
          `pt-28 pb-16` with no min-height and rendered 380px against every
          other page's 630px, which is what made the openings uneven. */}
      <PageHeroFallback
        eyebrow="Team & Advisors"
        headline="The people behind the work"
        tagline="PaceMakers is senior by design. Every mandate is led directly by a partner, supported by a focused analytical bench."
      />

      <section className="bg-[color:var(--pmbc-surface-cream)] px-6 py-20 lg:py-28">
        {/* The row count is published so the sitemap check can ask the page
            whether this collection has anything in it, rather than matching the
            empty-state wording, which is copy and will change. */}
        <div className="mx-auto max-w-[1100px]" data-collection-count={team.length}>
          {team.length === 0 ? (
            <p className="text-center text-[16px] text-[color:var(--pmbc-muted)]">
              Profiles are being prepared and will appear here shortly.
            </p>
          ) : (
            <ul className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {team.map((m) => (
                <li
                  key={m.id}
                  className="flex flex-col rounded-[2px] border border-[color:var(--pmbc-border-warm)] bg-white p-7"
                >
                  <div
                    className="mb-5 h-40 w-full overflow-hidden rounded-[2px]"
                    style={{ background: '#1B3A5F' }}
                  >
                    {m.photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.photo} alt={m.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <span className="font-serif text-3xl text-[#C69C3E]">
                          {m.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}
                        </span>
                      </div>
                    )}
                  </div>
                  <h2 className="font-serif text-[20px] font-semibold text-[color:var(--pmbc-text)]">
                    {m.name}
                  </h2>
                  {m.role && (
                    <p className="mt-1 text-[14px] text-[color:var(--pmbc-accent-muted)]">{m.role}</p>
                  )}
                  {m.credentials && (
                    <p className="mt-1 text-[12px] uppercase text-[color:var(--pmbc-muted)]" style={{ letterSpacing: '0.08em' }}>
                      {m.credentials}
                    </p>
                  )}
                  {m.bio && (
                    <div
                      className="pmbc-prose mt-4 text-[14px] leading-[1.7] text-[color:var(--pmbc-muted)]"
                      dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(m.bio) }}
                    />
                  )}
                  <div className="mt-5 flex gap-3">
                    {m.linkedin_url && (
                      <a
                        href={m.linkedin_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`${m.name} on LinkedIn`}
                        className="inline-flex items-center gap-1 text-[12px] font-semibold uppercase text-[color:var(--pmbc-muted)] transition hover:text-[color:var(--pmbc-primary)]"
                        style={{ letterSpacing: '0.08em' }}
                      >
                        <ExternalLink size={15} /> LinkedIn
                      </a>
                    )}
                    {m.email && (
                      <a
                        href={`mailto:${m.email}`}
                        aria-label={`Email ${m.name}`}
                        className="text-[color:var(--pmbc-muted)] transition hover:text-[color:var(--pmbc-primary)]"
                      >
                        <Mail size={17} />
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </main>
  );
}
