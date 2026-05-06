import Link from 'next/link';

import { SectionContainer } from '../SectionContainer';
import { variantStyles, type PmbcVariant } from '@/lib/public/tokens';

function s(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

type CtaContent = {
  eyebrow: string;
  headline: string;
  subhead: string;
  cta_primary_label: string;
  cta_primary_href: string;
  cta_secondary_label: string;
  cta_secondary_href: string;
};

function pick(c: Record<string, unknown>): CtaContent {
  const primaryObj = (c.primary_cta && typeof c.primary_cta === 'object'
    ? c.primary_cta
    : c.cta_primary && typeof c.cta_primary === 'object'
      ? c.cta_primary
      : {}) as Record<string, unknown>;
  const secondaryObj = (c.secondary_cta && typeof c.secondary_cta === 'object'
    ? c.secondary_cta
    : c.cta_secondary && typeof c.cta_secondary === 'object'
      ? c.cta_secondary
      : {}) as Record<string, unknown>;
  return {
    eyebrow: s(c.eyebrow),
    headline: s(c.headline),
    subhead: s(c.subhead),
    cta_primary_label: s(c.cta_primary_label) || s(c.cta_label) || s(primaryObj.label),
    cta_primary_href: s(c.cta_primary_href) || s(c.cta_href) || s(primaryObj.href),
    cta_secondary_label: s(c.cta_secondary_label) || s(secondaryObj.label),
    cta_secondary_href: s(c.cta_secondary_href) || s(secondaryObj.href),
  };
}

export function CtaBlock({
  content,
  variant = 'navy_deep',
}: {
  content: Record<string, unknown>;
  styles: Record<string, unknown>;
  variant: PmbcVariant;
}) {
  const c = pick(content ?? {});
  if (!c.headline && !c.subhead && !c.cta_primary_label) return null;

  const v = variantStyles(variant);
  const dark = variant === 'navy_deep';

  return (
    <SectionContainer variant={variant}>
      <div className="mx-auto max-w-[860px] text-center">
        <div
          aria-hidden
          className="mx-auto h-px w-[60px]"
          style={{ background: dark ? '#D4A93A' : '#B89530' }}
        />
        {c.eyebrow && (
          <p
            className="mt-5 text-[11px] font-semibold uppercase"
            style={{
              letterSpacing: '0.18em',
              color: dark ? '#D4A93A' : '#B89530',
            }}
          >
            {c.eyebrow}
          </p>
        )}
        {c.headline && (
          <h2
            className="pmbc-display mt-5 text-[36px] leading-[1.12] sm:text-[44px] lg:text-[52px]"
            style={{ color: dark ? '#FFFFFF' : v.text }}
          >
            {c.headline}
          </h2>
        )}
        {c.subhead && (
          <p
            className="mx-auto mt-5 max-w-[640px] text-[17px] leading-[1.7] sm:text-[18px]"
            style={{ color: dark ? v.textMuted : '#52606B' }}
          >
            {c.subhead}
          </p>
        )}
        {(c.cta_primary_label || c.cta_secondary_label) && (
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            {c.cta_primary_label && c.cta_primary_href && (
              <Link
                href={c.cta_primary_href}
                className={
                  'inline-flex items-center justify-center px-8 py-3.5 text-[12px] font-semibold uppercase transition duration-200 ' +
                  (dark
                    ? 'border border-[#D4A93A] text-[#E8DDC4] hover:bg-[#D4A93A] hover:text-[#0F2F4F]'
                    : 'border border-[#153D64] bg-[#153D64] text-white hover:bg-[#0F2F4F]')
                }
                style={{ letterSpacing: '0.12em' }}
              >
                {c.cta_primary_label}
              </Link>
            )}
            {c.cta_secondary_label && c.cta_secondary_href && (
              <Link
                href={c.cta_secondary_href}
                className={
                  'inline-flex items-center justify-center px-8 py-3.5 text-[12px] font-semibold uppercase transition duration-200 ' +
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
    </SectionContainer>
  );
}
