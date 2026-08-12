import Link from 'next/link';

import { SectionContainer, SectionIntro } from '../SectionContainer';
import { visibleListItems } from '@/lib/public/itemVisibility';
import { variantStyles, type PmbcVariant } from '@/lib/public/tokens';
import type { SectionMediaValue } from '@/lib/cms/sectionMedia';

/**
 * Large cards carrying a description, metadata chips, a bullet list and a CTA.
 *
 * `service_cards` was the closest existing type and could not do this: it has
 * no bullets, no metadata chips and no per-card call to action. The Financial
 * Modeler Pro page needs all three twice over, once for the two platforms and
 * once for the two certification paths, and those two blocks differ only in
 * which fields they populate. One type serves both rather than two nearly
 * identical ones.
 *
 * An external `cta_href` opens in a new tab with `rel="noopener noreferrer"`.
 * The judgement is the link's destination, not a flag on the row: a CTA leaving
 * PMBC for the platform should not lose the reader's place on the page they
 * were reading, and an author should not have to remember to say so.
 */

type Card = {
  title: string;
  code: string;
  description: string;
  meta: string[];
  bullets: string[];
  ctaLabel: string;
  ctaHref: string;
  note: string;
};

function s(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function strings(raw: unknown): string[] {
  return visibleListItems(raw)
    .map((i) => (typeof i === 'string' ? i.trim() : s((i as Record<string, unknown>)?.label) || s((i as Record<string, unknown>)?.title)))
    .filter(Boolean);
}

function pickCards(raw: unknown): Card[] {
  return visibleListItems(raw)
    .map((row) => {
      if (!row || typeof row !== 'object') return null;
      const o = row as Record<string, unknown>;
      const title = s(o.title);
      if (!title) return null;
      return {
        title,
        code: s(o.code),
        description: s(o.description),
        meta: strings(o.meta),
        bullets: strings(o.bullets),
        ctaLabel: s(o.cta_label),
        ctaHref: s(o.cta_href),
        note: s(o.note),
      };
    })
    .filter((c): c is Card => !!c);
}

const isExternal = (href: string) => /^https?:\/\//i.test(href);

export function FeatureCards({
  content,
  styles,
  variant = 'white',
  media = null,
}: {
  content: Record<string, unknown>;
  styles: Record<string, unknown>;
  variant: PmbcVariant;
  media?: SectionMediaValue | null;
}) {
  const c = content ?? {};
  const cards = pickCards(c.cards);
  if (cards.length === 0) return null;

  const v = variantStyles(variant);
  const dark = variant === 'navy_deep';

  return (
    <SectionContainer variant={variant} styles={styles} media={media}>
      <SectionIntro
        eyebrow={s(c.eyebrow)}
        headline={s(c.heading) || s(c.headline)}
        intro={s(c.intro)}
        variant={variant}
      />

      <div
        className={
          'mt-10 grid gap-8 ' + (cards.length > 2 ? 'md:grid-cols-2 lg:grid-cols-3' : 'md:grid-cols-2')
        }
      >
        {cards.map((card) => (
          <article
            key={card.title}
            className="flex flex-col"
            style={{
              background: v.cardBg,
              border: `1px solid ${v.cardBorder}`,
              borderRadius: 8,
              padding: '36px 32px',
            }}
          >
            {card.code && (
              <p
                className="text-[11px] font-semibold uppercase"
                style={{ letterSpacing: '0.18em', color: v.eyebrow }}
              >
                {card.code}
              </p>
            )}
            <h3
              className="pmbc-display mt-3 text-[26px] leading-[1.2] sm:text-[30px]"
              style={{ color: v.text }}
            >
              {card.title}
            </h3>

            {card.meta.length > 0 && (
              <ul className="mt-5 flex flex-wrap gap-2">
                {card.meta.map((m) => (
                  <li
                    key={m}
                    className="text-[11px] font-semibold uppercase"
                    style={{
                      letterSpacing: '0.1em',
                      color: dark ? '#E8DDC4' : '#1B3A5F',
                      border: `1px solid ${dark ? 'rgba(232,221,196,0.3)' : '#E8DDC4'}`,
                      background: dark ? 'rgba(255,255,255,0.04)' : 'rgba(198,156,62,0.08)',
                      padding: '5px 11px',
                      borderRadius: 999,
                    }}
                  >
                    {m}
                  </li>
                ))}
              </ul>
            )}

            {card.description && (
              <p
                className="mt-6 text-[15px] leading-[1.7]"
                style={{ color: v.textMuted }}
              >
                {card.description}
              </p>
            )}

            {card.bullets.length > 0 && (
              <ul className="mt-7 flex flex-col gap-3">
                {card.bullets.map((b) => (
                  <li key={b} className="flex items-start gap-3">
                    <span
                      aria-hidden
                      className="mt-[7px] h-[5px] w-[5px] shrink-0 rounded-full"
                      style={{ background: dark ? '#C69C3E' : '#A88530' }}
                    />
                    <span className="text-[14.5px] leading-[1.6]" style={{ color: v.textMuted }}>
                      {b}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {card.note && (
              <p
                className="mt-6 text-[13px] leading-[1.55]"
                style={{ color: v.textMuted, fontStyle: 'italic' }}
              >
                {card.note}
              </p>
            )}

            {card.ctaLabel && card.ctaHref && (
              <div className="mt-8 pt-2" style={{ marginTop: 'auto', paddingTop: 32 }}>
                {isExternal(card.ctaHref) ? (
                  <a
                    href={card.ctaHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center border border-[#1B3A5F] bg-[#1B3A5F] px-7 py-3 text-[12px] font-semibold uppercase text-[#E8DDC4] transition duration-200 hover:border-[#C69C3E] hover:bg-[#C69C3E] hover:text-[#14304F]"
                    style={{ letterSpacing: '0.12em' }}
                  >
                    {card.ctaLabel}
                  </a>
                ) : (
                  <Link
                    href={card.ctaHref}
                    className="inline-flex items-center justify-center border border-[#1B3A5F] bg-[#1B3A5F] px-7 py-3 text-[12px] font-semibold uppercase text-[#E8DDC4] transition duration-200 hover:border-[#C69C3E] hover:bg-[#C69C3E] hover:text-[#14304F]"
                    style={{ letterSpacing: '0.12em' }}
                  >
                    {card.ctaLabel}
                  </Link>
                )}
              </div>
            )}
          </article>
        ))}
      </div>
    </SectionContainer>
  );
}
