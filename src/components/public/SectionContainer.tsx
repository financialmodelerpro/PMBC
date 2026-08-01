import { variantStyles, type PmbcVariant } from '@/lib/public/tokens';
import {
  parseSectionStyles,
  sectionInnerStyle,
  sectionOuterClassName,
  sectionOuterStyle,
} from '@/lib/public/sectionStyles';

/**
 * Shared wrapper for every public section. Owns the section padding rhythm
 * (96-120px desktop / 64-80px tablet / 56-64px mobile) and the navy/cream/
 * white background variants. Children should not set their own outer
 * background or vertical padding, only inner spacing.
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
}: {
  variant?: PmbcVariant;
  size?: 'default' | 'compact';
  children: React.ReactNode;
  className?: string;
  /** Raw `page_sections.styles`. Omit for sections rendered outside the CMS. */
  styles?: unknown;
}) {
  const v = variantStyles(variant);
  const padding =
    size === 'compact'
      ? 'px-6 py-16 sm:py-20 lg:py-24'
      : 'px-6 py-20 sm:py-24 lg:py-32';

  const overrides = parseSectionStyles(styles);
  const extraClass = sectionOuterClassName(overrides);

  return (
    <section
      className={['relative', padding, className, extraClass]
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
        className="mx-auto w-full max-w-[1200px]"
        style={sectionInnerStyle(overrides)}
      >
        {children}
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
