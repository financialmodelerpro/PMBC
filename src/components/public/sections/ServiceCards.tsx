import Link from 'next/link';

type Card = { number: string; title: string; description: string; link: string };

function pickCards(content: Record<string, unknown>): { intro: string; cards: Card[] } {
  const intro = typeof content?.intro === 'string' ? content.intro : '';
  const raw =
    (Array.isArray(content?.cards) && (content.cards as unknown[])) ||
    (Array.isArray(content?.items) && (content.items as unknown[])) ||
    [];
  const cards: Card[] = raw
    .map((c) => {
      if (!c || typeof c !== 'object') return null;
      const o = c as Record<string, unknown>;
      return {
        number: typeof o.number === 'string' ? o.number : '',
        title: typeof o.title === 'string' ? o.title : '',
        description: typeof o.description === 'string' ? o.description : '',
        link: typeof o.link === 'string' ? o.link : '',
      } as Card;
    })
    .filter((c): c is Card => c !== null && (c.title.length > 0 || c.description.length > 0));
  return { intro, cards };
}

export function ServiceCards({ content }: { content: Record<string, unknown> }) {
  const { intro, cards } = pickCards(content ?? {});
  if (cards.length === 0 && !intro) return null;

  return (
    <section className="px-6 py-20">
      <div className="mx-auto max-w-6xl">
        {intro && (
          <p className="mx-auto max-w-2xl text-center text-base text-neutral-600">{intro}</p>
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
      </div>
    </section>
  );
}
