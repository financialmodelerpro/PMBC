import Link from 'next/link';

import { SectionContainer } from '../SectionContainer';
import { Media } from '../Media';
import { readMediaValue } from '@/lib/media';
import { variantStyles, type PmbcVariant } from '@/lib/public/tokens';

function s(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

type FounderHeroContent = {
  eyebrow: string;
  name: string;
  title_primary: string;
  title_accent: string;
  credentials_line: string;
  intro: string;
  photo_url: string;
  cta_primary_label: string;
  cta_primary_href: string;
  cta_secondary_label: string;
  cta_secondary_href: string;
};

function pick(c: Record<string, unknown>): FounderHeroContent {
  return {
    eyebrow: s(c.eyebrow),
    name: s(c.name),
    title_primary: s(c.title_primary),
    title_accent: s(c.title_accent),
    credentials_line: s(c.credentials_line),
    intro: s(c.intro),
    photo_url: s(c.photo_url),
    cta_primary_label: s(c.cta_primary_label),
    cta_primary_href: s(c.cta_primary_href),
    cta_secondary_label: s(c.cta_secondary_label),
    cta_secondary_href: s(c.cta_secondary_href),
  };
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'PM';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function isExternal(href: string): boolean {
  return /^https?:\/\//i.test(href);
}

/** Outward-pointing arrow, shown on links that leave the site. */
function ExternalIcon() {
  return (
    <svg
      aria-hidden
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4.5 1.5h6v6" />
      <path d="M10.5 1.5 5 7" />
      <path d="M9 7.5v3h-7.5V3h3" />
    </svg>
  );
}

/**
 * The identity block at the top of the founder profile page.
 *
 * Distinct from `founder_block`, which is a mid-page card summarising the
 * founder on the home and about pages. This is the page's own hero: it carries
 * the two-line title treatment (role in light navy text, specialism in gold),
 * the credentials line, and the outbound CTAs.
 *
 * Follows the Phase 9.5 founder pattern for the portrait: gold hairline frame,
 * navy accent corner, monogram fallback when no photo is set, so the page is
 * presentable before the real portrait is uploaded.
 */
export function FounderHero({
  content,
  styles,
  variant = 'navy_deep',
}: {
  content: Record<string, unknown>;
  styles: Record<string, unknown>;
  variant: PmbcVariant;
}) {
  const c = pick(content ?? {});
  const media = readMediaValue(content ?? {}, 'photo_url');
  if (!c.name && !c.intro && !c.eyebrow) return null;
  const v = variantStyles(variant);
  const dark = variant === 'navy_deep';

  const bodyColor = dark ? '#E8DDC4' : v.textMuted;
  const titleColor = dark ? '#B7CBE0' : '#1B3A5F';

  return (
    // `size="hero"` rather than the default rhythm: this is the block a visitor
    // lands on, so it takes the same 70vh every other page-leading hero does
    // instead of being sized by its portrait.
    <SectionContainer variant={variant} styles={styles} size="hero">
      <div className="grid items-center gap-12 lg:grid-cols-[minmax(240px,340px)_minmax(0,1fr)] lg:gap-16">
        <div>
          <div className="relative aspect-[4/5] w-full">
            <div aria-hidden className="absolute -inset-2 border border-[#C69C3E]" />
            <div
              aria-hidden
              className="absolute -right-2 -bottom-2 h-8 w-8"
              style={{ background: dark ? '#C69C3E' : '#1B3A5F' }}
            />
            {c.photo_url ? (
              <div className="relative aspect-[4/5] w-full overflow-hidden bg-neutral-100">
                <Media
                  src={media.url}
                  alt={c.name || 'Founder portrait'}
                  mediaType={media.mediaType}
                  posterUrl={media.posterUrl}
                  autoplay={media.autoplay}
                  loop={media.loop}
                  controls={media.controls}
                  fill
                  priority
                  sizes="(min-width: 1024px) 400px, 90vw"
                  className="object-cover"
                />
              </div>
            ) : (
              <div
                className="flex aspect-[4/5] w-full items-center justify-center"
                style={{
                  background: dark ? 'rgba(255,255,255,0.05)' : v.cardBg,
                  color: dark ? '#C69C3E' : '#1B3A5F',
                }}
              >
                <span className="pmbc-display text-[80px] tracking-tight">
                  {getInitials(c.name)}
                </span>
              </div>
            )}
          </div>
        </div>

        <div>
          <div aria-hidden className="h-px w-[60px]" style={{ background: v.eyebrow }} />
          {c.eyebrow && (
            <p
              className="mt-5 text-[11px] font-semibold uppercase"
              style={{ letterSpacing: '0.18em', color: v.eyebrow }}
            >
              {c.eyebrow}
            </p>
          )}
          {c.name && (
            <h1
              className="pmbc-display mt-4 text-[40px] leading-[1.1] sm:text-[52px] lg:text-[60px]"
              style={{ color: v.text }}
            >
              {c.name}
            </h1>
          )}
          {c.title_primary && (
            <p className="mt-4 text-[17px] leading-[1.5] sm:text-[19px]" style={{ color: titleColor }}>
              {c.title_primary}
            </p>
          )}
          {c.title_accent && (
            <p
              className="mt-1 text-[17px] font-semibold sm:text-[19px]"
              style={{ color: '#C69C3E' }}
            >
              {c.title_accent}
            </p>
          )}
          {c.credentials_line && (
            <p
              className="mt-6 text-[11px] font-semibold uppercase"
              style={{ letterSpacing: '0.16em', color: dark ? 'rgba(232,221,196,0.75)' : v.textMuted }}
            >
              {c.credentials_line}
            </p>
          )}
          {c.intro && (
            <p className="mt-7 max-w-[620px] text-[17px] leading-[1.75]" style={{ color: bodyColor }}>
              {c.intro}
            </p>
          )}

          {/* CTAs render only when both a label and an href are set. A founder
              profile is a credibility document, so a button that goes nowhere
              is worse than no button. */}
          {((c.cta_primary_label && c.cta_primary_href) ||
            (c.cta_secondary_label && c.cta_secondary_href)) && (
            <div className="mt-9 flex flex-wrap items-center gap-4">
              {c.cta_primary_label && c.cta_primary_href && (
                <CtaLink
                  href={c.cta_primary_href}
                  label={c.cta_primary_label}
                  primary
                  dark={dark}
                />
              )}
              {c.cta_secondary_label && c.cta_secondary_href && (
                <CtaLink
                  href={c.cta_secondary_href}
                  label={c.cta_secondary_label}
                  dark={dark}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </SectionContainer>
  );
}

function CtaLink({
  href,
  label,
  primary = false,
  dark,
}: {
  href: string;
  label: string;
  primary?: boolean;
  dark: boolean;
}) {
  const external = isExternal(href);
  const className =
    'inline-flex items-center gap-2 border px-6 py-3 text-[12px] font-semibold uppercase transition';
  const style: React.CSSProperties = primary
    ? {
        letterSpacing: '0.14em',
        borderColor: '#C69C3E',
        background: '#C69C3E',
        color: '#14304F',
      }
    : {
        letterSpacing: '0.14em',
        borderColor: dark ? 'rgba(232,221,196,0.35)' : '#1B3A5F',
        background: 'transparent',
        color: dark ? '#E8DDC4' : '#1B3A5F',
      };

  const inner = (
    <>
      {label}
      {external && <ExternalIcon />}
    </>
  );

  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        style={style}
      >
        {inner}
      </a>
    );
  }
  return (
    <Link href={href} className={className} style={style}>
      {inner}
    </Link>
  );
}
