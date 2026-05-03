import Link from 'next/link';

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

export function ServiceCards({ content }: { content: Record<string, unknown> }) {
  const { eyebrow, headline, intro, cards, footer_cta_label, footer_cta_href } = pickCards(
    content ?? {},
  );
  if (cards.length === 0 && !intro && !headline && !eyebrow) return null;

  return (
    <section className="px-6 py-20">
      <div className="mx-auto max-w-6xl">
        {(eyebrow || headline || intro) && (
          <div className="mx-auto max-w-3xl text-center">
            {eyebrow && (
              <p className="text-[11px] font-medium tracking-[0.22em] uppercase text-[#1B3A5F]">
                {eyebrow}
              </p>
            )}
            {headline && (
              <h2 className="mt-3 font-serif text-3xl font-semibold tracking-tight text-[#0F1B2D] sm:text-4xl">
                {headline}
              </h2>
            )}
            {intro && (
              <p className="mt-4 text-base text-neutral-600 sm:text-lg">{intro}</p>
            )}
          </div>
        )}
        {cards.length > 0 && (
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map((card, i) => {
              const inner = (
                <>
                  {card.number && (
                    <p className="text-[11px] font-medium tracking-[0.18em] uppercase text-[#1B3A5F]">
                      {card.number}
                    </p>
                  )}
                  {card.title && (
                    <h3 className="mt-3 text-lg font-semibold tracking-tight text-[#0F1B2D]">
                      {card.title}
                    </h3>
                  )}
                  {card.description && (
                    <p className="mt-2 text-sm text-neutral-600">{card.description}</p>
                  )}
                </>
              );
              if (card.link) {
                return (
                  <Link
                    key={i}
                    href={card.link}
                    className="group rounded-lg border border-neutral-200 bg-white p-6 transition hover:border-[#1B3A5F] hover:shadow-[0_2px_10px_rgba(15,27,45,0.06)]"
                  >
                    {inner}
                  </Link>
                );
              }
              return (
                <div key={i} className="rounded-lg border border-neutral-200 bg-white p-6">
                  {inner}
                </div>
              );
            })}
          </div>
        )}
        {footer_cta_label && footer_cta_href && (
          <div className="mt-10 text-center">
            <Link
              href={footer_cta_href}
              className="inline-flex items-center rounded-md border border-neutral-300 px-5 py-2.5 text-sm font-medium text-[#0F1B2D] transition hover:border-[#1B3A5F] hover:text-[#1B3A5F]"
            >
              {footer_cta_label}
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
