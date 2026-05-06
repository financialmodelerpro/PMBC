import Image from 'next/image';

import { SectionContainer } from '../SectionContainer';
import { variantStyles, type PmbcVariant } from '@/lib/public/tokens';

function s(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

type QuoteContent = {
  quote_text: string;
  attribution_name: string;
  attribution_role: string;
  attribution_photo_url: string;
  alignment: 'center' | 'left';
};

function pick(c: Record<string, unknown>): QuoteContent {
  return {
    quote_text: s(c.quote_text) || s(c.quote),
    attribution_name: s(c.attribution_name),
    attribution_role: s(c.attribution_role),
    attribution_photo_url: s(c.attribution_photo_url),
    alignment: c.alignment === 'left' ? 'left' : 'center',
  };
}

export function Quote({
  content,
  variant = 'white',
}: {
  content: Record<string, unknown>;
  styles: Record<string, unknown>;
  variant: PmbcVariant;
}) {
  const c = pick(content ?? {});
  if (!c.quote_text) return null;
  const left = c.alignment === 'left';
  const v = variantStyles(variant);
  const dark = variant === 'navy_deep';

  return (
    <SectionContainer variant={variant}>
      <figure
        className={'mx-auto max-w-[800px] ' + (left ? 'text-left' : 'text-center')}
      >
        <span
          aria-hidden
          className="font-serif"
          style={{
            display: 'block',
            fontSize: 80,
            lineHeight: 0.8,
            color: dark ? '#D4A93A' : '#B89530',
            textAlign: left ? 'left' : 'center',
            fontWeight: 600,
          }}
        >
          &ldquo;
        </span>
        <blockquote
          className="font-serif italic"
          style={{
            marginTop: 12,
            fontSize: 28,
            lineHeight: 1.5,
            color: dark ? '#FFFFFF' : v.text,
            fontWeight: 400,
            textAlign: left ? 'left' : 'center',
            letterSpacing: '-0.005em',
          }}
        >
          {c.quote_text}
        </blockquote>
        {(c.attribution_name || c.attribution_role || c.attribution_photo_url) && (
          <figcaption
            className={
              'mt-10 flex items-center gap-4 ' + (left ? '' : 'justify-center')
            }
          >
            {c.attribution_photo_url && (
              <div className="relative h-12 w-12 overflow-hidden rounded-full bg-neutral-100">
                <Image
                  src={c.attribution_photo_url}
                  alt={c.attribution_name || ''}
                  fill
                  sizes="48px"
                  className="object-cover"
                />
              </div>
            )}
            <div className={left ? '' : 'text-center'}>
              <div
                aria-hidden
                className={(left ? '' : 'mx-auto ') + 'h-px w-[40px]'}
                style={{ background: dark ? '#D4A93A' : '#B89530' }}
              />
              {c.attribution_name && (
                <p
                  className="mt-3 text-[12px] font-semibold uppercase"
                  style={{
                    letterSpacing: '0.18em',
                    color: dark ? '#FFFFFF' : v.text,
                  }}
                >
                  {c.attribution_name}
                </p>
              )}
              {c.attribution_role && (
                <p
                  className="mt-1.5 text-[11px] uppercase"
                  style={{
                    letterSpacing: '0.16em',
                    color: dark ? v.textMuted : '#6B7280',
                  }}
                >
                  {c.attribution_role}
                </p>
              )}
            </div>
          </figcaption>
        )}
      </figure>
    </SectionContainer>
  );
}
