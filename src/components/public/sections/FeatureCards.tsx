import Link from 'next/link';

import { SectionContainer, SectionIntro } from '../SectionContainer';
import { Media } from '../Media';
import { MediaFrameChrome } from '../SectionMediaLayout';
import { visibleListItems } from '@/lib/public/itemVisibility';
import { variantStyles, type PmbcVariant } from '@/lib/public/tokens';
import { readMediaValue, type MediaValue } from '@/lib/media';
import {
  MEDIA_MAX_HEIGHT_KEY,
  readMediaMaxHeight,
  type SectionMediaValue,
} from '@/lib/cms/sectionMedia';

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
  /** Per-card media, used by the rows layout. Blank renders a monogram panel. */
  media: MediaValue;
  mediaAlt: string;
  /** Pixel ceiling on this card's frame. Null means the asset's own height. */
  mediaMaxHeight: number | null;
};

/**
 * `cards` puts them side by side, `rows` stacks them full width with the media
 * alternating sides.
 *
 * Rows exist because two cards side by side are only as short as the taller
 * one: on /fmp the Training Hub card carried fewer bullets than Modeling Hub
 * and sat under a visible gap. Stacking removes the comparison entirely, and
 * gives each platform the width its description was written for.
 */
type Layout = 'cards' | 'rows';

function readLayout(raw: unknown): Layout {
  return raw === 'rows' ? 'rows' : 'cards';
}

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
        // Same key set and the same reader as every other media slot on the
        // site, so an upload made in the card editor behaves identically here.
        media: readMediaValue(o, 'media_url'),
        mediaAlt: s(o.media_alt),
        // The same key, bounds and clamping as every other media ceiling on the
        // site, read per card rather than per section: two rows sitting one
        // above the other hold different assets, and one number covering both
        // would be a ceiling for whichever of them is taller.
        mediaMaxHeight: readMediaMaxHeight(o[MEDIA_MAX_HEIGHT_KEY]),
      };
    })
    .filter((c): c is Card => !!c);
}

/** Two letters for the placeholder panel, as the audience carousel does. */
function initials(title: string): string {
  return title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
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
  const layout = readLayout(c.layout);

  const intro = (
    <SectionIntro
      eyebrow={s(c.eyebrow)}
      headline={s(c.heading) || s(c.headline)}
      intro={s(c.intro)}
      variant={variant}
    />
  );

  if (layout === 'rows') {
    return (
      <SectionContainer variant={variant} styles={styles} media={media}>
        {intro}
        <div className="mt-12 flex flex-col gap-14 lg:gap-20">
          {cards.map((card, i) => (
            <FeatureRow
              key={card.title}
              card={card}
              // The first row puts its media on the right and they alternate
              // from there, so the page reads text, media, media, text down the
              // centre line rather than repeating the same shape twice.
              mediaLeft={i % 2 === 1}
              variant={variant}
            />
          ))}
        </div>
      </SectionContainer>
    );
  }

  return (
    <SectionContainer variant={variant} styles={styles} media={media}>
      {intro}

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
            <CardHead card={card} variant={variant} />

            {card.description && (
              <p
                className="mt-6 text-[15px] leading-[1.7]"
                style={{ color: v.textMuted }}
              >
                {card.description}
              </p>
            )}

            <Bullets bullets={card.bullets} variant={variant} className="mt-7" />

            {card.note && (
              <p
                className="mt-6 text-[13px] leading-[1.55]"
                style={{ color: v.textMuted, fontStyle: 'italic' }}
              >
                {card.note}
              </p>
            )}

            {card.ctaLabel && card.ctaHref && (
              <div style={{ marginTop: 'auto', paddingTop: 32 }}>
                <CardCta label={card.ctaLabel} href={card.ctaHref} />
              </div>
            )}
          </article>
        ))}
      </div>
    </SectionContainer>
  );
}

/**
 * The code line, the title and the metadata chips.
 *
 * Shared by both layouts rather than written twice, so a change to the chip
 * treatment cannot land in one layout and not the other.
 */
function CardHead({ card, variant }: { card: Card; variant: PmbcVariant }) {
  const v = variantStyles(variant);
  const dark = variant === 'navy_deep';
  return (
    <>
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
    </>
  );
}

function Bullets({
  bullets,
  variant,
  className = '',
}: {
  bullets: string[];
  variant: PmbcVariant;
  className?: string;
}) {
  if (bullets.length === 0) return null;
  const v = variantStyles(variant);
  const dark = variant === 'navy_deep';
  return (
    <ul className={`flex flex-col gap-3 ${className}`}>
      {bullets.map((b) => (
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
  );
}

function CardCta({ label, href }: { label: string; href: string }) {
  const cls =
    'inline-flex items-center justify-center border border-[#1B3A5F] bg-[#1B3A5F] px-7 py-3 text-[12px] font-semibold uppercase text-[#E8DDC4] transition duration-200 hover:border-[#C69C3E] hover:bg-[#C69C3E] hover:text-[#14304F]';
  const style = { letterSpacing: '0.12em' };
  return isExternal(href) ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={cls} style={style}>
      {label}
    </a>
  ) : (
    <Link href={href} className={cls} style={style}>
      {label}
    </Link>
  );
}

/**
 * One full-width row: the copy on one side, the media on the other.
 *
 * The split and the stacking rule are the ones the shared media layout settled
 * on in Phase 31, deliberately: 55/45 in favour of the text from 1024px up, and
 * the text first in the DOM so a narrow screen always leads with the words. The
 * sides are resolved with `order` at `lg` only, which is what makes both of
 * those true at once.
 */
function FeatureRow({
  card,
  mediaLeft,
  variant,
}: {
  card: Card;
  mediaLeft: boolean;
  variant: PmbcVariant;
}) {
  const v = variantStyles(variant);

  const copy = (
    <div className={mediaLeft ? 'lg:order-2' : 'lg:order-1'}>
      <CardHead card={card} variant={variant} />

      {card.description && (
        <p className="mt-6 text-[16px] leading-[1.75]" style={{ color: v.textMuted }}>
          {card.description}
        </p>
      )}

      <Bullets bullets={card.bullets} variant={variant} className="mt-7" />

      {card.note && (
        <p
          className="mt-6 text-[13px] leading-[1.55]"
          style={{ color: v.textMuted, fontStyle: 'italic' }}
        >
          {card.note}
        </p>
      )}

      {card.ctaLabel && card.ctaHref && (
        <div className="mt-8">
          <CardCta label={card.ctaLabel} href={card.ctaHref} />
        </div>
      )}
    </div>
  );

  const maxHeight = card.mediaMaxHeight;

  const frame = (
    <div className={mediaLeft ? 'lg:order-1' : 'lg:order-2'}>
      <MediaFrameChrome
        variant={variant}
        // A filled slot takes the asset's own proportions, as every other framed
        // media on the site does, and the ceiling clamps its height without
        // cropping any of it. An empty slot has no proportions to take, so it
        // keeps the 4:3 box that holds the row's shape until someone uploads:
        // a frame collapsing to nothing would read as a text block with a stray
        // gold rule beside it.
        style={
          card.media.url
            ? undefined
            : { aspectRatio: '4 / 3', maxHeight: maxHeight ?? undefined }
        }
      >
        {card.media.url ? (
          <Media
            src={card.media.url}
            alt={card.mediaAlt || card.title}
            mediaType={card.media.mediaType}
            posterUrl={card.media.posterUrl}
            autoplay={card.media.autoplay}
            loop={card.media.loop}
            controls={card.media.controls}
            width={1200}
            height={800}
            sizes="(min-width: 1024px) 520px, 92vw"
            className={maxHeight ? 'h-auto w-full object-contain' : 'h-auto w-full'}
            style={maxHeight ? { maxHeight } : undefined}
          />
        ) : (
          // Same placeholder as an audience carousel card with no image yet: a
          // monogram panel, so an unfilled slot looks deliberate rather than
          // broken, and the row keeps the shape it will have once filled.
          <div
            className="flex h-full w-full items-center justify-center"
            style={{
              background:
                'radial-gradient(ellipse at 50% 35%, #1F4269 0%, #1B3A5F 60%, #14304F 100%)',
            }}
          >
            <span className="pmbc-display text-[44px]" style={{ color: '#C69C3E' }}>
              {initials(card.title)}
            </span>
          </div>
        )}
      </MediaFrameChrome>
    </div>
  );

  return (
    <article
      className={
        'grid items-center gap-10 lg:gap-16 ' +
        (mediaLeft ? 'lg:grid-cols-[45fr_55fr]' : 'lg:grid-cols-[55fr_45fr]')
      }
    >
      {copy}
      {frame}
    </article>
  );
}
