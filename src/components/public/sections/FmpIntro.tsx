import Image from 'next/image';
import { ArrowUpRight, CheckCircle2 } from 'lucide-react';

import { SectionContainer } from '../SectionContainer';
import { variantStyles, type PmbcVariant } from '@/lib/public/tokens';

function s(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

type FmpContent = {
  heading: string;
  description_html: string;
  feature_points: string[];
  cta_label: string;
  cta_href: string;
  logo_url: string;
};

function pick(c: Record<string, unknown>): FmpContent {
  const rawPoints =
    (Array.isArray(c.feature_points) && (c.feature_points as unknown[])) ||
    (Array.isArray(c.features) && (c.features as unknown[])) ||
    [];
  const feature_points = rawPoints
    .map((p) => (typeof p === 'string' ? p : null))
    .filter((p): p is string => !!p && p.length > 0);
  return {
    heading: s(c.heading),
    description_html: s(c.description_html) || s(c.description),
    feature_points,
    cta_label: s(c.cta_label) || 'Visit Financial Modeler Pro',
    cta_href: s(c.cta_href) || 'https://www.financialmodelerpro.com',
    logo_url: s(c.logo_url),
  };
}

export function FmpIntro({
  content,
  variant = 'navy_deep',
}: {
  content: Record<string, unknown>;
  styles: Record<string, unknown>;
  variant: PmbcVariant;
}) {
  const c = pick(content ?? {});
  if (!c.heading && !c.description_html && c.feature_points.length === 0) return null;
  const external = /^https?:/i.test(c.cta_href);
  const v = variantStyles(variant);
  const dark = variant === 'navy_deep';

  return (
    <SectionContainer variant={variant}>
      <div
        className="relative mx-auto max-w-[1000px] p-10 sm:p-14 lg:p-16"
        style={{
          background: dark ? 'rgba(255, 255, 255, 0.03)' : v.cardBg,
          border: `1px solid ${dark ? 'rgba(232, 221, 196, 0.18)' : v.cardBorder}`,
        }}
      >
        <span
          aria-hidden
          className="absolute top-0 left-0 right-0 h-[2px]"
          style={{ background: '#D4A93A' }}
        />
        {c.logo_url && (
          <div className="relative mb-7 h-12 w-48">
            <Image
              src={c.logo_url}
              alt="Financial Modeler Pro"
              fill
              sizes="192px"
              className="object-contain object-left"
            />
          </div>
        )}
        <div
          aria-hidden
          className="h-px w-[60px]"
          style={{ background: dark ? '#D4A93A' : '#B89530' }}
        />
        <p
          className="mt-5 text-[11px] font-semibold uppercase"
          style={{
            letterSpacing: '0.18em',
            color: dark ? '#D4A93A' : '#B89530',
          }}
        >
          Financial Modeler Pro
        </p>
        {c.heading && (
          <h2
            className="pmbc-display mt-4 text-[34px] leading-[1.12] sm:text-[42px] lg:text-[44px]"
            style={{ color: dark ? '#FFFFFF' : v.text }}
          >
            {c.heading}
          </h2>
        )}
        {c.description_html && (
          <div
            className="prose prose-invert mt-6 max-w-none"
            style={{
              color: dark ? '#E8DDC4' : v.text,
              fontSize: 17,
              lineHeight: 1.7,
            }}
            dangerouslySetInnerHTML={{ __html: c.description_html }}
          />
        )}
        {c.feature_points.length > 0 && (
          <ul className="mt-8 grid gap-3 sm:grid-cols-2">
            {c.feature_points.map((point, i) => (
              <li
                key={i}
                className="flex items-start gap-2.5 text-[15px] leading-[1.6]"
                style={{ color: dark ? '#E8DDC4' : v.text }}
              >
                <CheckCircle2
                  size={16}
                  strokeWidth={2}
                  className="mt-1 flex-shrink-0"
                  style={{ color: '#3FA663' }}
                />
                <span>{point}</span>
              </li>
            ))}
          </ul>
        )}
        {c.cta_label && c.cta_href && (
          <div className="mt-10">
            <a
              href={c.cta_href}
              target={external ? '_blank' : undefined}
              rel={external ? 'noreferrer' : undefined}
              className={
                'group inline-flex items-center gap-2 px-8 py-3.5 text-[12px] font-semibold uppercase transition duration-200 ' +
                (dark
                  ? 'border border-[#D4A93A] text-[#E8DDC4] hover:bg-[#D4A93A] hover:text-[#0F2F4F]'
                  : 'border border-[#153D64] bg-[#153D64] text-white hover:bg-[#0F2F4F]')
              }
              style={{ letterSpacing: '0.12em' }}
            >
              {c.cta_label}
              <ArrowUpRight size={14} className="transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </a>
          </div>
        )}
      </div>
    </SectionContainer>
  );
}
