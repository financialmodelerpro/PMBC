import Link from 'next/link';
import Image from 'next/image';

import { SectionContainer } from '../SectionContainer';
import { variantStyles, type PmbcVariant } from '@/lib/public/tokens';

function s(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

type TextImageContent = {
  eyebrow: string;
  heading: string;
  body_html: string;
  image_url: string;
  image_alt: string;
  image_caption: string;
  image_position: 'left' | 'right';
  cta_label: string;
  cta_href: string;
};

function pick(c: Record<string, unknown>): TextImageContent {
  const ctaObj = (c.cta && typeof c.cta === 'object' ? c.cta : {}) as Record<string, unknown>;
  return {
    eyebrow: s(c.eyebrow),
    heading: s(c.heading),
    body_html: s(c.body_html) || s(c.body),
    image_url: s(c.image_url),
    image_alt: s(c.image_alt),
    image_caption: s(c.image_caption),
    image_position: c.image_position === 'left' ? 'left' : 'right',
    cta_label: s(c.cta_label) || s(ctaObj.label),
    cta_href: s(c.cta_href) || s(ctaObj.href),
  };
}

export function TextImage({
  content,
  variant = 'cream',
}: {
  content: Record<string, unknown>;
  styles: Record<string, unknown>;
  variant: PmbcVariant;
}) {
  const c = pick(content ?? {});
  if (!c.heading && !c.body_html && !c.image_url && !c.eyebrow) return null;
  const imageLeft = c.image_position === 'left';
  const v = variantStyles(variant);
  const dark = variant === 'navy_deep';

  return (
    <SectionContainer variant={variant}>
      <div
        className={
          'grid items-center gap-12 lg:grid-cols-2 lg:gap-20 ' +
          (imageLeft
            ? 'lg:[&>div:first-child]:order-1 lg:[&>div:last-child]:order-2'
            : 'lg:[&>div:first-child]:order-2 lg:[&>div:last-child]:order-1')
        }
      >
        <div>
          {c.image_url ? (
            <figure>
              <div className="relative aspect-[4/3] w-full">
                <div
                  aria-hidden
                  className="absolute -inset-2 border border-[#D4A93A]"
                />
                <div className="relative aspect-[4/3] w-full overflow-hidden bg-neutral-100">
                  <Image
                    src={c.image_url}
                    alt={c.image_alt || ''}
                    fill
                    sizes="(min-width: 1024px) 560px, 90vw"
                    className="object-cover"
                  />
                </div>
              </div>
              {c.image_caption && (
                <figcaption
                  className="mt-5 text-[11px] uppercase"
                  style={{
                    letterSpacing: '0.16em',
                    color: dark ? v.textMuted : '#6B7280',
                  }}
                >
                  {c.image_caption}
                </figcaption>
              )}
            </figure>
          ) : (
            <div className="relative aspect-[4/3] w-full">
              <div
                aria-hidden
                className="absolute -inset-2 border border-[#D4A93A]"
              />
              <div
                className="aspect-[4/3] w-full"
                style={{ background: v.cardBg }}
              />
            </div>
          )}
        </div>
        <div>
          <div
            aria-hidden
            className="h-px w-[60px]"
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
          {c.heading && (
            <h2
              className="pmbc-display mt-4 text-[34px] leading-[1.12] sm:text-[42px] lg:text-[44px]"
              style={{ color: dark ? '#FFFFFF' : v.text }}
            >
              {c.heading}
            </h2>
          )}
          {c.body_html && (
            <div
              className="prose prose-neutral mt-6 max-w-none"
              style={{
                color: dark ? '#E8DDC4' : v.text,
                fontSize: 17,
                lineHeight: 1.75,
              }}
              dangerouslySetInnerHTML={{ __html: c.body_html }}
            />
          )}
          {c.cta_label && c.cta_href && (
            <div className="mt-9">
              <Link
                href={c.cta_href}
                className={
                  'inline-flex items-center justify-center px-8 py-3.5 text-[12px] font-semibold uppercase transition duration-200 ' +
                  (dark
                    ? 'border border-[#D4A93A] text-[#E8DDC4] hover:bg-[#D4A93A] hover:text-[#0F2F4F]'
                    : 'border border-[#153D64] bg-[#153D64] text-white hover:bg-[#0F2F4F]')
                }
                style={{ letterSpacing: '0.12em' }}
              >
                {c.cta_label}
              </Link>
            </div>
          )}
        </div>
      </div>
    </SectionContainer>
  );
}
