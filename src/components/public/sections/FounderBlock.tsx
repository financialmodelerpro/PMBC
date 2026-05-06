import Link from 'next/link';
import Image from 'next/image';

import { SectionContainer, SectionIntro } from '../SectionContainer';
import { variantStyles, type PmbcVariant } from '@/lib/public/tokens';

function s(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

type FounderContent = {
  eyebrow: string;
  section_headline: string;
  photo_url: string;
  name: string;
  credentials_line: string;
  bio_html: string;
  cta_primary_label: string;
  cta_primary_href: string;
  cta_secondary_label: string;
  cta_secondary_href: string;
  layout: 'image_left' | 'image_right';
};

function pick(c: Record<string, unknown>): FounderContent {
  const layout = c.layout === 'image_right' ? 'image_right' : 'image_left';
  const primaryObj = (c.cta_primary && typeof c.cta_primary === 'object'
    ? c.cta_primary
    : {}) as Record<string, unknown>;
  const secondaryObj = (c.cta_secondary && typeof c.cta_secondary === 'object'
    ? c.cta_secondary
    : {}) as Record<string, unknown>;
  return {
    eyebrow: s(c.eyebrow),
    section_headline: s(c.headline),
    photo_url: s(c.photo_url),
    name: s(c.name),
    credentials_line: s(c.credentials_line) || s(c.title),
    bio_html: s(c.bio_html) || s(c.bio),
    cta_primary_label: s(c.cta_primary_label) || s(primaryObj.label),
    cta_primary_href: s(c.cta_primary_href) || s(primaryObj.href),
    cta_secondary_label: s(c.cta_secondary_label) || s(secondaryObj.label),
    cta_secondary_href: s(c.cta_secondary_href) || s(secondaryObj.href),
    layout,
  };
}

function getInitials(name: string): string {
  if (!name) return 'PM';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'PM';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function FounderBlock({
  content,
  variant = 'cream',
}: {
  content: Record<string, unknown>;
  styles: Record<string, unknown>;
  variant: PmbcVariant;
}) {
  const c = pick(content ?? {});
  if (!c.name && !c.bio_html && !c.photo_url && !c.section_headline && !c.eyebrow) return null;
  const imageRight = c.layout === 'image_right';
  const v = variantStyles(variant);

  return (
    <SectionContainer variant={variant}>
      <SectionIntro
        eyebrow={c.eyebrow}
        headline={c.section_headline}
        variant={variant}
      />

      <div
        className={
          'mt-14 grid items-center gap-12 lg:grid-cols-[minmax(280px,440px)_minmax(0,1fr)] lg:gap-20 ' +
          (imageRight ? 'lg:[&>div:first-child]:order-2' : '')
        }
      >
        <div>
          {c.photo_url ? (
            <div className="relative aspect-[4/5] w-full">
              {/* Gold frame */}
              <div
                aria-hidden
                className="absolute -inset-2 border border-[#D4A93A]"
              />
              {/* Navy accent corner — bottom-right */}
              <div
                aria-hidden
                className="absolute -right-2 -bottom-2 h-8 w-8"
                style={{ background: '#153D64' }}
              />
              <div className="relative aspect-[4/5] w-full overflow-hidden bg-neutral-100">
                <Image
                  src={c.photo_url}
                  alt={c.name || 'Founder portrait'}
                  fill
                  sizes="(min-width: 1024px) 440px, 90vw"
                  className="object-cover"
                />
              </div>
            </div>
          ) : (
            <div className="relative aspect-[4/5] w-full">
              <div
                aria-hidden
                className="absolute -inset-2 border border-[#D4A93A]"
              />
              <div
                aria-hidden
                className="absolute -right-2 -bottom-2 h-8 w-8"
                style={{ background: '#153D64' }}
              />
              <div
                className="flex aspect-[4/5] w-full items-center justify-center"
                style={{ background: v.cardBg, color: '#153D64' }}
              >
                <span className="font-serif text-[80px] font-semibold tracking-tight">
                  {getInitials(c.name)}
                </span>
              </div>
            </div>
          )}
        </div>

        <div>
          {c.name && (
            <h3
              className="pmbc-display text-[32px] leading-[1.15] sm:text-[40px]"
              style={{ color: v.text }}
            >
              {c.name}
            </h3>
          )}
          {c.credentials_line && (
            <p
              className="mt-3 text-[11px] font-semibold uppercase"
              style={{
                letterSpacing: '0.18em',
                color: v.eyebrow,
              }}
            >
              {c.credentials_line}
            </p>
          )}
          {c.bio_html && (
            <div
              className="prose prose-neutral mt-7 max-w-none"
              style={{ color: v.text, fontSize: 17, lineHeight: 1.7 }}
              dangerouslySetInnerHTML={{ __html: c.bio_html }}
            />
          )}
          {(c.cta_primary_label || c.cta_secondary_label) && (
            <div className="mt-9 flex flex-wrap items-center gap-6">
              {c.cta_primary_label && c.cta_primary_href && (
                <Link
                  href={c.cta_primary_href}
                  className="group inline-flex items-center gap-2 text-[13px] font-semibold uppercase text-[#153D64] transition hover:text-[#D4A93A]"
                  style={{ letterSpacing: '0.12em' }}
                >
                  <span className="relative pb-1">
                    {c.cta_primary_label}
                    <span
                      aria-hidden
                      className="absolute right-0 bottom-0 left-0 h-px bg-[#D4A93A] transition-transform duration-200"
                    />
                  </span>
                  <span aria-hidden className="text-[#D4A93A]">→</span>
                </Link>
              )}
              {c.cta_secondary_label && c.cta_secondary_href && (
                <Link
                  href={c.cta_secondary_href}
                  className="text-[13px] font-medium uppercase text-[#52606B] transition hover:text-[#153D64]"
                  style={{ letterSpacing: '0.12em' }}
                >
                  {c.cta_secondary_label}
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </SectionContainer>
  );
}
