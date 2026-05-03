import Link from 'next/link';
import Image from 'next/image';

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

export function TextImage({ content }: { content: Record<string, unknown> }) {
  const c = pick(content ?? {});
  if (!c.heading && !c.body_html && !c.image_url && !c.eyebrow) return null;
  const imageLeft = c.image_position === 'left';

  return (
    <section className="px-6 py-20 lg:py-24">
      <div className="mx-auto max-w-6xl">
        <div
          className={
            'grid items-center gap-10 lg:grid-cols-2 lg:gap-16 ' +
            (imageLeft ? 'lg:[&>div:first-child]:order-1 lg:[&>div:last-child]:order-2' : 'lg:[&>div:first-child]:order-2 lg:[&>div:last-child]:order-1')
          }
        >
          <div>
            {c.image_url ? (
              <figure>
                <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-neutral-100">
                  <Image
                    src={c.image_url}
                    alt={c.image_alt || ''}
                    fill
                    sizes="(min-width: 1024px) 560px, 90vw"
                    className="object-cover"
                  />
                </div>
                {c.image_caption && (
                  <figcaption className="mt-3 text-xs text-neutral-500">{c.image_caption}</figcaption>
                )}
              </figure>
            ) : (
              <div className="aspect-[4/3] w-full rounded-lg bg-neutral-100" />
            )}
          </div>
          <div>
            {c.eyebrow && (
              <p className="text-[11px] font-medium tracking-[0.22em] uppercase text-[#1B3A5F]">
                {c.eyebrow}
              </p>
            )}
            {c.heading && (
              <h2 className={`font-serif text-3xl font-semibold tracking-tight text-[#0F1B2D] sm:text-4xl ${c.eyebrow ? 'mt-3' : ''}`}>
                {c.heading}
              </h2>
            )}
            {c.body_html && (
              <div
                className="prose prose-neutral mt-5 max-w-none text-[#0F1B2D]"
                dangerouslySetInnerHTML={{ __html: c.body_html }}
              />
            )}
            {c.cta_label && c.cta_href && (
              <div className="mt-7">
                <Link
                  href={c.cta_href}
                  className="inline-flex items-center rounded-md bg-[#1B3A5F] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[#0F2540]"
                >
                  {c.cta_label}
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
