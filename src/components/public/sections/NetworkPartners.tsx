import Link from 'next/link';
import Image from 'next/image';
import { ArrowUpRight } from 'lucide-react';

import { SectionContainer, SectionIntro } from '../SectionContainer';
import { variantStyles, type PmbcVariant } from '@/lib/public/tokens';

type Partner = {
  logo_url: string;
  name: string;
  location: string;
  description: string;
  role_tag: string;
  link: string;
};

function s(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function pickPartners(c: Record<string, unknown>): {
  intro: string;
  heading: string;
  eyebrow: string;
  partners: Partner[];
} {
  const intro = s(c.intro);
  const heading = s(c.heading) || s(c.headline);
  const eyebrow = s(c.eyebrow);
  const raw = Array.isArray(c.partners) ? (c.partners as unknown[]) : [];
  const partners: Partner[] = raw
    .map((row) => {
      if (!row || typeof row !== 'object') return null;
      const o = row as Record<string, unknown>;
      const name = s(o.name);
      const description = s(o.description);
      if (!name && !description) return null;
      return {
        logo_url: s(o.logo_url),
        name,
        location: s(o.location),
        description,
        role_tag: s(o.role_tag),
        link: s(o.link),
      };
    })
    .filter((p): p is Partner => p !== null);
  return { intro, heading, eyebrow, partners };
}

export function NetworkPartners({
  content,
  variant = 'cream',
}: {
  content: Record<string, unknown>;
  styles: Record<string, unknown>;
  variant: PmbcVariant;
}) {
  const { intro, heading, eyebrow, partners } = pickPartners(content ?? {});
  if (partners.length === 0 && !heading && !intro) return null;

  const v = variantStyles(variant);
  const dark = variant === 'navy_deep';

  return (
    <SectionContainer variant={variant}>
      <SectionIntro
        eyebrow={eyebrow}
        headline={heading}
        intro={intro}
        variant={variant}
      />

      {partners.length > 0 && (
        <div
          className={
            'mt-14 grid gap-6 ' +
            (partners.length >= 3
              ? 'md:grid-cols-3'
              : partners.length === 2
                ? 'md:grid-cols-2'
                : 'md:grid-cols-1')
          }
        >
          {partners.map((p, i) => {
            const inner = (
              <>
                <span
                  aria-hidden
                  className="absolute top-0 left-0 right-0 h-[2px]"
                  style={{ background: '#D4A93A' }}
                />
                <div className="flex items-start justify-between gap-3">
                  {p.logo_url ? (
                    <div className="relative h-14 w-36 flex-shrink-0">
                      <Image
                        src={p.logo_url}
                        alt={p.name || 'Partner logo'}
                        fill
                        sizes="144px"
                        className="object-contain object-left"
                      />
                    </div>
                  ) : (
                    <div
                      className="flex h-14 w-36 items-center justify-start"
                      style={{ color: dark ? v.textMuted : '#9CA3AF' }}
                    >
                      <span className="text-[10px] font-semibold uppercase tracking-[0.18em]">
                        {p.name || 'Partner'}
                      </span>
                    </div>
                  )}
                  {p.role_tag && (
                    <span
                      className="inline-flex items-center px-2.5 py-1 text-[10px] font-semibold uppercase"
                      style={{
                        letterSpacing: '0.14em',
                        border: '1px solid #D4A93A',
                        color: '#B89530',
                        background: 'transparent',
                      }}
                    >
                      {p.role_tag}
                    </span>
                  )}
                </div>
                {p.name && (
                  <h3
                    className="mt-7 pmbc-display text-[22px] leading-tight"
                    style={{ color: dark ? '#FFFFFF' : v.text }}
                  >
                    {p.name}
                  </h3>
                )}
                {p.location && (
                  <p
                    className="mt-2 text-[11px] font-semibold uppercase"
                    style={{
                      letterSpacing: '0.14em',
                      color: dark ? v.textMuted : v.eyebrow,
                    }}
                  >
                    {p.location}
                  </p>
                )}
                {p.description && (
                  <p
                    className="mt-4 text-[15px] leading-[1.7]"
                    style={{ color: dark ? v.textMuted : '#52606B' }}
                  >
                    {p.description}
                  </p>
                )}
                {p.link && (
                  <span
                    className="mt-7 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase"
                    style={{ letterSpacing: '0.16em', color: '#B89530' }}
                  >
                    Visit site <ArrowUpRight size={12} />
                  </span>
                )}
              </>
            );

            const baseClass =
              'group relative block h-full overflow-hidden p-9 transition duration-200';
            const cardStyle: React.CSSProperties = {
              background: v.cardBg,
              border: `1px solid ${dark ? v.cardBorder : '#153D64'}`,
              borderTopWidth: 0,
            };

            if (p.link) {
              const external = /^https?:/i.test(p.link);
              return (
                <Link
                  key={i}
                  href={p.link}
                  className={
                    baseClass +
                    ' hover:-translate-y-0.5 hover:shadow-[0_12px_40px_rgba(15,37,64,0.10)]'
                  }
                  style={cardStyle}
                  target={external ? '_blank' : undefined}
                  rel={external ? 'noreferrer' : undefined}
                >
                  {inner}
                </Link>
              );
            }
            return (
              <div key={i} className={baseClass} style={cardStyle}>
                {inner}
              </div>
            );
          })}
        </div>
      )}
    </SectionContainer>
  );
}
