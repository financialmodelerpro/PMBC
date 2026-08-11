import Link from 'next/link';
import { ChevronDown } from 'lucide-react';

import { RichText } from '@/components/public/RichText';
import { visibleListItems } from '@/lib/public/itemVisibility';
import { SectionMediaLayout } from '../SectionMediaLayout';
import type { SectionMediaValue } from '@/lib/cms/sectionMedia';
import { variantStyles, type PmbcVariant } from '@/lib/public/tokens';
import {
  parseSectionStyles,
  sectionInnerStyle,
  sectionOuterClassName,
  sectionOuterStyle,
} from '@/lib/public/sectionStyles';

type HeroContent = {
  badge_text?: string;
  headline?: string;
  subtitle?: string;
  /** Short capability labels, rendered as a tidy grid under the subtitle. */
  tags: string[];
  cta_label?: string;
  cta_href?: string;
  cta_secondary_label?: string;
  cta_secondary_href?: string;
};

function s(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function pick(c: Record<string, unknown>): HeroContent {
  return {
    badge_text: s(c.badge_text) || s(c.badge),
    headline: s(c.headline),
    subtitle: s(c.subtitle),
    tags: visibleListItems(c.tags)
      .map((t) => (typeof t === 'string' ? t.trim() : s((t as Record<string, unknown>)?.label)))
      .filter(Boolean),
    cta_label: s(c.cta_label),
    cta_href: s(c.cta_href),
    cta_secondary_label: s(c.cta_secondary_label),
    cta_secondary_href: s(c.cta_secondary_href),
  };
}

export function Hero({
  content,
  styles,
  variant = 'navy_deep',
  media = null,
}: {
  content: Record<string, unknown>;
  styles: Record<string, unknown>;
  variant: PmbcVariant;
  media?: SectionMediaValue | null;
}) {
  const c = pick(content ?? {});
  const dark = variant === 'navy_deep';
  const v = variantStyles(variant);

  // Hero is the one section that does not use SectionContainer (it owns an
  // 88vh layout and a radial gradient), so it applies the StyleEditor overrides
  // itself. Same precedence: variant first, operator overrides on top.
  const parsed = parseSectionStyles(styles);
  const overrides = {
    style: { ...sectionOuterStyle(parsed) },
    inner: sectionInnerStyle(parsed),
    className: sectionOuterClassName(parsed),
  };

  // Subtle radial gradient for the navy variant: lighter primary at center,
  // deeper navy at edges. On non-navy variants the section is a flat surface.
  const bg = dark
    ? 'radial-gradient(ellipse at 50% 35%, #1F4269 0%, #1B3A5F 55%, #14304F 100%)'
    : v.bg;

  return (
    <section
      // 70vh rather than the original 88vh so the next section is visible above
      // the fold. Applies to every CMS hero, not only the home page: /contact
      // and /book were equally tall and gain the same benefit.
      className={`relative flex min-h-[70vh] items-center px-6 py-24 sm:py-28 ${overrides.className}`.trim()}
      style={{ background: bg, color: v.text, ...overrides.style }}
    >
      {/* Faint diagonal pattern overlay, kept extremely subtle. */}
      {dark && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              'repeating-linear-gradient(45deg, #C69C3E 0, #C69C3E 1px, transparent 1px, transparent 14px)',
          }}
        />
      )}

      <div
        className="relative mx-auto w-full max-w-[1100px] text-center"
        style={overrides.inner}
      >
        <SectionMediaLayout media={media} variant={variant}>
        <div
          aria-hidden
          className="mx-auto h-px w-[80px]"
          style={{ background: v.eyebrow }}
        />
        {c.badge_text && (
          <p
            className="mt-6 text-[11px] font-semibold uppercase"
            style={{ letterSpacing: '0.18em', color: v.eyebrow }}
          >
            {c.badge_text}
          </p>
        )}
        {c.headline && (
          <h1
            // The xl step drops from 80px to 72px: at 80px the shipped headline
            // "Advisory from Structure to Exit" overflowed the 1100px column and
            // left "Exit" alone on line two. `text-wrap: balance` is the belt to
            // that braces, so a longer headline an operator writes later splits
            // into even lines instead of leaving an orphan. Browsers without it
            // simply wrap as before.
            className="pmbc-display mt-6 text-[40px] leading-[1.05] sm:text-[56px] lg:text-[64px] xl:text-[72px]"
            style={{
              color: dark ? '#FFFFFF' : v.text,
              textWrap: 'balance',
            }}
          >
            {c.headline}
          </h1>
        )}
        {c.subtitle && (
          <p
            // 820px, chosen by measuring the real line breaks rather than by
            // eye. At the previous 720px the shipped subtitle broke after
            // "family", splitting "family offices" across two lines. Narrowing
            // does not fix that: every width from 700px down to 580px produces
            // three lines, and 780 to 740 still breaks after "family". Only at
            // 800px and above does line one end on the comma after "family
            // offices,", keeping the phrase intact and the hero at two lines.
            // `text-wrap: pretty` then guards against a one-word last line if an
            // operator rewrites this copy.
            className="mx-auto mt-7 max-w-[820px] text-[18px] leading-[1.65] sm:text-[20px]"
            style={{
              color: dark ? v.textMuted : '#52606B',
              fontWeight: 400,
              textWrap: 'pretty',
            }}
          >
            <RichText html={c.subtitle} as="span" />
          </p>
        )}

        {/* Capability tags, directly under the subtitle so they read as part of
            it rather than as a section of their own.

            A GRID, NOT A WRAPPING FLEX ROW. Flex wrap breaks wherever the line
            runs out, which for the eight tags on /fmp produced a ragged five
            then three. A grid with a fixed column count per breakpoint always
            fills rows evenly: four and four on desktop, three and three plus
            two on tablet, two per row on mobile. `w-fit` keeps the grid itself
            only as wide as its content so the whole block stays centred, and
            `justify-items-center` stops each pill stretching to its column. */}
        {c.tags.length > 0 && (
          <ul className="mx-auto mt-8 grid w-fit grid-cols-2 justify-items-center gap-x-3 gap-y-2.5 sm:grid-cols-3 lg:grid-cols-4">
            {c.tags.map((tag) => (
              <li
                key={tag}
                className="whitespace-nowrap text-[11px] font-semibold uppercase"
                style={{
                  letterSpacing: '0.12em',
                  color: dark ? '#E8DDC4' : '#1B3A5F',
                  border: `1px solid ${dark ? 'rgba(198, 156, 62, 0.45)' : '#E8DDC4'}`,
                  background: dark ? 'rgba(198, 156, 62, 0.08)' : 'rgba(198, 156, 62, 0.08)',
                  padding: '6px 14px',
                  borderRadius: 999,
                }}
              >
                {tag}
              </li>
            ))}
          </ul>
        )}

        {(c.cta_label || c.cta_secondary_label) && (
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            {c.cta_label && c.cta_href && (
              <Link
                href={c.cta_href}
                className={
                  'group inline-flex items-center justify-center px-8 py-3.5 text-[13px] font-semibold uppercase transition duration-200 ' +
                  (dark
                    ? 'border border-[#C69C3E] text-[#E8DDC4] hover:bg-[#C69C3E] hover:text-[#14304F]'
                    : 'border border-[#1B3A5F] bg-[#1B3A5F] text-white hover:bg-[#14304F]')
                }
                style={{ letterSpacing: '0.12em' }}
              >
                {c.cta_label}
              </Link>
            )}
            {c.cta_secondary_label && c.cta_secondary_href && (
              <Link
                href={c.cta_secondary_href}
                className={
                  'inline-flex items-center justify-center px-8 py-3.5 text-[13px] font-semibold uppercase transition duration-200 ' +
                  (dark
                    ? 'border border-[#E8DDC4]/30 text-[#E8DDC4] hover:border-[#C69C3E] hover:text-[#C69C3E]'
                    : 'border border-[#1B3A5F]/30 text-[#1B3A5F] hover:border-[#1B3A5F]')
                }
                style={{ letterSpacing: '0.12em' }}
              >
                {c.cta_secondary_label}
              </Link>
            )}
          </div>
        )}
        </SectionMediaLayout>
      </div>

      {/* Scroll indicator */}
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-8 left-1/2 -translate-x-1/2"
      >
        <ChevronDown
          size={22}
          strokeWidth={1.5}
          style={{ color: dark ? '#A88530' : '#A88530' }}
          className="opacity-60"
        />
      </div>
    </section>
  );
}
