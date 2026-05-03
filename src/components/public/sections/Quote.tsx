import Image from 'next/image';

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

export function Quote({ content }: { content: Record<string, unknown> }) {
  const c = pick(content ?? {});
  if (!c.quote_text) return null;
  const left = c.alignment === 'left';

  return (
    <section className="px-6 py-20 lg:py-24">
      <figure
        className={
          'mx-auto max-w-3xl ' + (left ? 'text-left' : 'text-center')
        }
      >
        <span
          aria-hidden
          className={
            'block font-serif text-6xl leading-none text-[#D4A93A] ' +
            (left ? '' : 'text-center')
          }
        >
          “
        </span>
        <blockquote
          className={
            'mt-2 font-serif text-2xl leading-relaxed text-[#0F1B2D] sm:text-3xl ' +
            (left ? '' : 'text-center')
          }
        >
          {c.quote_text}
        </blockquote>
        {(c.attribution_name || c.attribution_role || c.attribution_photo_url) && (
          <figcaption
            className={
              'mt-8 flex items-center gap-4 ' +
              (left ? '' : 'justify-center')
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
            <div className={left ? '' : 'text-left'}>
              {c.attribution_name && (
                <p className="text-sm font-semibold text-[#0F1B2D]">{c.attribution_name}</p>
              )}
              {c.attribution_role && (
                <p className="text-xs text-neutral-500">{c.attribution_role}</p>
              )}
            </div>
          </figcaption>
        )}
      </figure>
    </section>
  );
}
