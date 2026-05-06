import Link from 'next/link';

import { SectionContainer, SectionIntro } from '../SectionContainer';
import { variantStyles, type PmbcVariant } from '@/lib/public/tokens';

type Card = { number: string; title: string; description: string; link: string };

function s(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function pickCards(content: Record<string, unknown>): {
  eyebrow: string;
  headline: string;
  intro: string;
  cards: Card[];
  footer_cta_label: string;
  footer_cta_href: string;
} {
  const intro = s(content?.intro);
  const eyebrow = s(content?.eyebrow);
  const headline = s(content?.headline);
  const footer_cta_label = s(content?.footer_cta_label);
  const footer_cta_href = s(content?.footer_cta_href);
  const raw =
    (Array.isArray(content?.cards) && (content.cards as unknown[])) ||
    (Array.isArray(content?.items) && (content.items as unknown[])) ||
    [];
  const cards: Card[] = raw
    .map((c) => {
      if (!c || typeof c !== 'object') return null;
      const o = c as Record<string, unknown>;
      return {
        number: s(o.number),
        title: s(o.title),
        description: s(o.description),
        link: s(o.link),
      } as Card;
    })
    .filter((c): c is Card => c !== null && (c.title.length > 0 || c.description.length > 0));
  return { eyebrow, headline, intro, cards, footer_cta_label, footer_cta_href };
}

export function ServiceCards({
  content,
  variant = 'cream',
}: {
  content: Record<string, unknown>;
  styles: Record<string, unknown>;
  variant: PmbcVariant;
}) {
  const { eyebrow, headline, intro, cards, footer_cta_label, footer_cta_href } = pickCards(
    content ?? {},
  );
  if (cards.length === 0 && !intro && !headline && !eyebrow) return null;

  const v = variantStyles(variant);
  const dark = variant === 'navy_deep';

  return (
    <SectionContainer variant={variant}>
      <SectionIntro
        eyebrow={eyebrow}
        headline={headline}
        intro={intro}
        variant={variant}
      />

      {cards.length > 0 && (
        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card, i) => {
            const inner = (
              <>
                {/* gold top accent */}
                <span
                  aria-hidden
                  className="absolute top-0 left-0 right-0 h-[2px] transition-all duration-200 group-hover:h-[3px]"
                  style={{ background: '#D4A93A' }}
                />
                {card.number && (
                  <p
                    className="font-serif text-[28px] font-semibold leading-none"
                    style={{ color: dark ? '#D4A93A' : '#B89530' }}
                  >
                    {card.number}
                  </p>
                )}
                {card.title && (
                  <h3
                    className="mt-5 font-serif text-[22px] font-semibold leading-tight"
                    style={{ color: v.text }}
                  >
                    {card.title}
                  </h3>
                )}
                {card.description && (
                  <p
                    className="mt-4 text-[15px] leading-[1.7]"
                    style={{ color: v.textMuted }}
                  >
                    {card.description}
                  </p>
                )}
              </>
            );

            const baseClass =
              'group relative flex h-full flex-col overflow-hidden p-9 transition duration-200';

            const cardStyle: React.CSSProperties = {
              background: v.cardBg,
              border: `1px solid ${v.cardBorder}`,
              color: v.text,
            };

            if (card.link) {
              return (
                <Link
                  key={i}
                  href={card.link}
                  className={
                    baseClass +
                    ' hover:-translate-y-0.5 hover:shadow-[0_12px_40px_rgba(15,37,64,0.08)]'
                  }
                  style={cardStyle}
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

      {footer_cta_label && footer_cta_href && (
        <div className="mt-12 text-center">
          <Link
            href={footer_cta_href}
            className={
              'inline-flex items-center justify-center px-8 py-3.5 text-[12px] font-semibold uppercase transition duration-200 ' +
              (dark
                ? 'border border-[#E8DDC4]/40 text-[#E8DDC4] hover:border-[#D4A93A] hover:text-[#D4A93A]'
                : 'border border-[#153D64]/30 text-[#153D64] hover:border-[#153D64] hover:bg-[#153D64] hover:text-white')
            }
            style={{ letterSpacing: '0.12em' }}
          >
            {footer_cta_label}
          </Link>
        </div>
      )}
    </SectionContainer>
  );
}
