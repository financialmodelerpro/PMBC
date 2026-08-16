import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';

import { SectionContainer } from '@/components/public/SectionContainer';
import type { PmbcVariant } from '@/lib/public/tokens';
import type { SectionContext } from '@/lib/public/sectionContext';
import { sectionCopy } from '@/lib/public/sectionCopy';

/**
 * The nine service cards on `/services`.
 *
 * This was written into the route file and rendered after every CMS section,
 * whatever order the builder showed. A `cta_block` placed after it in the
 * builder came out above it on the page, which is the bug migration 068 fixes:
 * the grid is a section now, so its place in the page is its place in the
 * builder and an operator can drag it.
 *
 * The cards themselves are not section content. They arrive through the
 * context, from the managed `services` collection with the static config as a
 * fallback, because the same nine feed the related-services cards, the contact
 * form's dropdown, the sitemap and the JSON-LD. What this section owns is the
 * copy above them: the eyebrow, the heading and the standfirst.
 */
export function ServiceGrid({
  content,
  styles,
  variant = 'white',
  context = {},
}: {
  content: Record<string, unknown>;
  styles?: unknown;
  variant?: PmbcVariant;
  context?: SectionContext;
}) {
  const cards = context.services ?? [];

  const eyebrow = sectionCopy(content, 'eyebrow', 'Practice Areas');
  const heading = sectionCopy(content, 'heading', 'Nine disciplines, one standard of work');
  const intro = sectionCopy(
    content,
    'intro',
    'Each engagement is led directly by the partner, modelled to institutional standards, and delivered with the documentation a board, lender, or investor will accept without rework.',
  );

  // Nothing to show and nothing to say. A heading over an empty grid reads as a
  // page that failed to load rather than one with no services configured.
  if (cards.length === 0 && !eyebrow && !heading && !intro) return null;

  return (
    <SectionContainer variant={variant} styles={styles}>
      {(eyebrow || heading || intro) && (
        <div className="mx-auto max-w-2xl text-center">
          <div
            aria-hidden
            className="mx-auto h-px w-[60px] bg-[color:var(--pmbc-accent-muted)]"
          />
          {eyebrow && (
            <p
              className="mt-5 text-[11px] font-semibold uppercase text-[color:var(--pmbc-accent-muted)]"
              style={{ letterSpacing: '0.18em' }}
            >
              {eyebrow}
            </p>
          )}
          {heading && (
            <h2 className="pmbc-display mt-4 text-[34px] leading-[1.12] sm:text-[42px] lg:text-[48px]">
              {heading}
            </h2>
          )}
          {intro && (
            <p className="mt-5 text-[17px] leading-[1.7] text-[#52606B] sm:text-[18px]">
              {intro}
            </p>
          )}
        </div>
      )}

      {cards.length > 0 && (
        <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((s) => (
            <li key={s.slug}>
              <Link
                href={`/services/${s.slug}`}
                className="group flex h-full flex-col rounded-[2px] border border-t-2 border-[color:var(--pmbc-border-warm)] bg-white p-9 transition hover:-translate-y-0.5 hover:border-[color:var(--pmbc-primary)] hover:shadow-[0_12px_36px_rgba(15,37,64,0.08)]"
                style={{ borderTopColor: '#C69C3E' }}
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
      )}
    </SectionContainer>
  );
}
