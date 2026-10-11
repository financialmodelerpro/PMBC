import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';

import { SectionContainer } from '@/components/public/SectionContainer';
import type { PmbcVariant } from '@/lib/public/tokens';
import type { SectionContext } from '@/lib/public/sectionContext';
import { sectionCopy } from '@/lib/public/sectionCopy';
import { SERVICE_GROUPS, serviceGroupOf } from '@/config/services';
import { MultilineText } from '../MultilineText';

/**
 * One treatment for every group (2026-10-11, the owner's revision of the
 * first layout, which colour-coded the groups): a primary navy header with
 * cream text, and white cards with a warm hairline and a navy top rule.
 */
const HEADER_BG = '#1B3A5F';
const HEADER_TEXT = '#FAF7F2';
const CARD_BORDER = '#E8E2D6';

/**
 * The nine service cards on `/services`, in three practice groups.
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
 * copy above them: the eyebrow, the heading, the standfirst and the three
 * group names (`group_1_name` to `group_3_name`, migration 106).
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

  // Three practice groups, one column each from 1024px and stacked below it.
  // Membership is by slug in the config; the cards keep the collection's order
  // within their group. A group with no cards is dropped.
  const groups = SERVICE_GROUPS.map((g) => ({
    key: g.key,
    name: sectionCopy(content, `group_${g.index}_name`, g.name),
    cards: cards.filter((c) => serviceGroupOf(c.slug) === g.key),
  })).filter((g) => g.cards.length > 0);
  // The header plus the longest group, so every column shares the same rows.
  const cardRows = Math.max(0, ...groups.map((g) => g.cards.length));
  const rowSpan = 1 + cardRows;

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
              <MultilineText text={intro} />
            </p>
          )}
        </div>
      )}

      {groups.length > 0 && (
        // From 1024px every card row is 1fr, so all nine cards take the height
        // of the tallest and the three columns line up row for row. The
        // template is ignored below 1024px, where the groups stack as flex.
        <div
          className="mt-12 flex flex-col gap-12 lg:grid lg:grid-cols-3 lg:gap-x-6 lg:gap-y-4"
          style={{ gridTemplateRows: `auto repeat(${cardRows}, 1fr)` }}
        >
          {groups.map((g) => (
            <section
              key={g.key}
              aria-labelledby={g.name ? `service-group-${g.key}` : undefined}
              className="flex flex-col gap-4 lg:grid lg:grid-rows-subgrid"
              style={{ gridRow: `span ${rowSpan}` }}
            >
              <header
                className="rounded-[2px] px-6 py-5"
                style={{ background: HEADER_BG, color: HEADER_TEXT }}
              >
                {g.name && (
                  <h3
                    id={`service-group-${g.key}`}
                    className="font-serif text-[22px] font-semibold leading-tight"
                  >
                    {g.name}
                  </h3>
                )}
                <p
                  className={`${g.name ? 'mt-1.5 ' : ''}text-[11px] font-semibold uppercase`}
                  style={{ letterSpacing: '0.18em', color: HEADER_TEXT }}
                >
                  {g.cards.length} {g.cards.length === 1 ? 'service' : 'services'}
                </p>
              </header>
              {/* `contents` from 1024px puts each card in a row of the parent
                  subgrid, so cards line up across the three columns. role="list"
                  keeps the list semantics Safari drops with display: contents. */}
              <ul role="list" className="flex flex-col gap-4 lg:contents">
                {g.cards.map((s) => (
                  <li key={s.slug} className="flex">
                    <Link
                      href={`/services/${s.slug}`}
                      className="group flex w-full flex-col rounded-[2px] border border-t-2 p-7 transition hover:-translate-y-0.5 hover:shadow-[0_12px_36px_rgba(15,37,64,0.08)]"
                      style={{
                        background: '#FFFFFF',
                        borderColor: CARD_BORDER,
                        borderTopColor: HEADER_BG,
                      }}
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
                      <h4 className="mt-4 font-serif text-[21px] font-semibold leading-tight text-[color:var(--pmbc-text)]">
                        {s.title}
                      </h4>
                      <p className="mt-3 text-[15px] leading-[1.7] text-[color:var(--pmbc-muted)]">
                        {s.summary}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </SectionContainer>
  );
}
