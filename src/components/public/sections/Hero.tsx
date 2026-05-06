import Link from 'next/link';
import { ChevronDown } from 'lucide-react';

import { variantStyles, type PmbcVariant } from '@/lib/public/tokens';

type HeroContent = {
  badge_text?: string;
  headline?: string;
  subtitle?: string;
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
    cta_label: s(c.cta_label),
    cta_href: s(c.cta_href),
    cta_secondary_label: s(c.cta_secondary_label),
    cta_secondary_href: s(c.cta_secondary_href),
  };
}

export function Hero({
  content,
  variant = 'navy_deep',
}: {
  content: Record<string, unknown>;
  styles: Record<string, unknown>;
  variant: PmbcVariant;
}) {
  const c = pick(content ?? {});
  const dark = variant === 'navy_deep';
  const v = variantStyles(variant);

  // Subtle radial gradient for the navy variant: lighter primary at center,
  // deeper navy at edges. On non-navy variants the section is a flat surface.
  const bg = dark
    ? 'radial-gradient(ellipse at 50% 35%, #173E63 0%, #102E4C 55%, #0C2741 100%)'
    : v.bg;

  return (
    <section
      className="relative flex min-h-[88vh] items-center px-6 py-28 sm:py-32"
      style={{ background: bg, color: v.text }}
    >
      {/* Faint diagonal pattern overlay — kept extremely subtle. */}
      {dark && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              'repeating-linear-gradient(45deg, #D4A93A 0, #D4A93A 1px, transparent 1px, transparent 14px)',
          }}
        />
      )}

      <div className="relative mx-auto w-full max-w-[1100px] text-center">
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
            className="pmbc-display mt-6 text-[40px] leading-[1.05] sm:text-[56px] lg:text-[72px] xl:text-[80px]"
            style={{
              color: dark ? '#FFFFFF' : v.text,
            }}
          >
            {c.headline}
          </h1>
        )}
        {c.subtitle && (
          <p
            className="mx-auto mt-7 max-w-[720px] text-[18px] leading-[1.65] sm:text-[20px]"
            style={{
              color: dark ? v.textMuted : '#52606B',
              fontWeight: 400,
            }}
          >
            {c.subtitle}
          </p>
        )}

        {(c.cta_label || c.cta_secondary_label) && (
          <div className="mt-12 flex flex-wrap items-center justify-center gap-4">
            {c.cta_label && c.cta_href && (
              <Link
                href={c.cta_href}
                className={
                  'group inline-flex items-center justify-center px-8 py-3.5 text-[13px] font-semibold uppercase transition duration-200 ' +
                  (dark
                    ? 'border border-[#D4A93A] text-[#E8DDC4] hover:bg-[#D4A93A] hover:text-[#0F2F4F]'
                    : 'border border-[#153D64] bg-[#153D64] text-white hover:bg-[#0F2F4F]')
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
                    ? 'border border-[#E8DDC4]/30 text-[#E8DDC4] hover:border-[#D4A93A] hover:text-[#D4A93A]'
                    : 'border border-[#153D64]/30 text-[#153D64] hover:border-[#153D64]')
                }
                style={{ letterSpacing: '0.12em' }}
              >
                {c.cta_secondary_label}
              </Link>
            )}
          </div>
        )}
      </div>

      {/* Scroll indicator */}
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-8 left-1/2 -translate-x-1/2"
      >
        <ChevronDown
          size={22}
          strokeWidth={1.5}
          style={{ color: dark ? '#B89530' : '#B89530' }}
          className="opacity-60"
        />
      </div>
    </section>
  );
}
