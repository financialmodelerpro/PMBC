import { variantStyles, type PmbcVariant } from '@/lib/public/tokens';
import {
  HERO_MIN_HEIGHT,
  HERO_PADDING,
  PAGE_GUTTER,
  PAGE_INNER,
  SECTION_PADDING,
  SECTION_PADDING_COMPACT,
} from '@/lib/public/layout';
import { SectionMediaLayout } from './SectionMediaLayout';
import type { SectionMediaValue } from '@/lib/cms/sectionMedia';
import {
  parseSectionStyles,
  sectionInnerStyle,
  sectionOuterClassName,
  sectionOuterStyle,
} from '@/lib/public/sectionStyles';

/**
 * Shared wrapper for every public section. Owns the section padding rhythm
 * (96px desktop / 80px tablet / 64px mobile, from `SECTION_PADDING`) and the
 * navy/cream/white background variants. Children should not set their own
 * outer background or vertical padding, only inner spacing.
 *
 * `size="hero"` is the third case: a page-leading block that fills 70vh and
 * centres its content, shared with the standalone `Hero` and
 * `PageHeroFallback` through `HERO_MIN_HEIGHT` / `HERO_PADDING` so a hero
 * rendered through this container is the same height as one that is not.
 *
 * Pass the section's raw `styles` JSONB to honour the admin StyleEditor
 * (parity Phase 5). Anything the operator leaves blank falls through to the
 * variant, so an empty `styles` renders exactly as it did before.
 */
export function SectionContainer({
  variant = 'white',
  size = 'default',
  children,
  className = '',
  styles,
  media = null,
}: {
  variant?: PmbcVariant;
  size?: 'default' | 'compact' | 'hero';
  children: React.ReactNode;
  className?: string;
  /** Raw `page_sections.styles`. Omit for sections rendered outside the CMS. */
  styles?: unknown;
  /**
   * Optional shared media for section types that have no dedicated field.
   * Null, which is the default, renders `children` with no wrapper at all.
   */
  media?: SectionMediaValue | null;
}) {
  const v = variantStyles(variant);
  const frame =
    size === 'hero'
      ? `flex ${HERO_MIN_HEIGHT} items-center ${PAGE_GUTTER} ${HERO_PADDING}`
      : size === 'compact'
        ? `${PAGE_GUTTER} ${SECTION_PADDING_COMPACT}`
        : `${PAGE_GUTTER} ${SECTION_PADDING}`;

  const overrides = parseSectionStyles(styles);
  const extraClass = sectionOuterClassName(overrides);

  return (
    <section
      className={['relative', frame, className, extraClass]
        .filter(Boolean)
        .join(' ')}
      style={{
        // Variant first, overrides second: an inline override of the same key
        // wins, and keys the operator left blank keep the variant value.
        background: v.bg,
        color: v.text,
        ...sectionOuterStyle(overrides),
      }}
    >
      <div
        className={PAGE_INNER}
        style={sectionInnerStyle(overrides)}
      >
        <SectionMediaLayout media={media} variant={variant}>
          {children}
        </SectionMediaLayout>
      </div>
    </section>
  );
}

/**
 * Editorial intro stack used at the top of most sections:
 *  - thin gold hairline (60px)
 *  - eyebrow (uppercase, tracked, muted gold or accent gold on dark)
 *  - serif headline
 *  - intro paragraph
 *
 * Pass `variant` to pick the right colors. Optionally pass `align` to
 * left-align (defaults to centered).
 */
export function SectionIntro({
  eyebrow,
  headline,
  intro,
  variant = 'white',
  align = 'center',
}: {
  eyebrow?: string;
  headline?: string;
  intro?: string;
  variant?: PmbcVariant;
  align?: 'center' | 'left';
}) {
  if (!eyebrow && !headline && !intro) return null;
  const v = variantStyles(variant);
  const wrapper =
    align === 'center'
      ? 'mx-auto max-w-3xl text-center'
      : 'max-w-3xl text-left';
  const hairlineWrapper = align === 'center' ? 'mx-auto' : '';
  return (
    <div className={wrapper}>
      <div
        aria-hidden
        className={`${hairlineWrapper} h-px w-[60px]`}
        style={{ background: v.eyebrow }}
      />
      {eyebrow && (
        <p
          className="mt-5 text-[11px] font-semibold uppercase"
          style={{
            letterSpacing: '0.18em',
            color: v.eyebrow,
          }}
        >
          {eyebrow}
        </p>
      )}
      {headline && (
        <h2
          className="pmbc-display mt-4 text-[34px] leading-[1.12] sm:text-[42px] lg:text-[48px]"
          style={{ color: v.text }}
        >
          {headline}
        </h2>
      )}
      {intro && (
        <p
          className="mt-5 text-[17px] leading-[1.7] sm:text-[18px]"
          style={{ color: v.textMuted }}
        >
          {intro}
        </p>
      )}
    </div>
  );
}
