import Link from 'next/link';
import Image from 'next/image';

function s(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

type FounderContent = {
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
  return {
    photo_url: s(c.photo_url),
    name: s(c.name),
    credentials_line: s(c.credentials_line) || s(c.title),
    bio_html: s(c.bio_html) || s(c.bio),
    cta_primary_label: s(c.cta_primary_label),
    cta_primary_href: s(c.cta_primary_href),
    cta_secondary_label: s(c.cta_secondary_label),
    cta_secondary_href: s(c.cta_secondary_href),
    layout,
  };
}

export function FounderBlock({ content }: { content: Record<string, unknown> }) {
  const c = pick(content ?? {});
  if (!c.name && !c.bio_html && !c.photo_url) return null;
  const imageRight = c.layout === 'image_right';

  return (
    <section className="px-6 py-20 lg:py-24">
      <div className="mx-auto max-w-6xl">
        <div
          className={
            'grid items-center gap-10 lg:grid-cols-[minmax(280px,420px)_minmax(0,1fr)] lg:gap-16 ' +
            (imageRight ? 'lg:[&>div:first-child]:order-2' : '')
          }
        >
          <div>
            {c.photo_url ? (
              <div className="relative aspect-[4/5] w-full overflow-hidden rounded-lg bg-neutral-100">
                <Image
                  src={c.photo_url}
                  alt={c.name || 'Founder portrait'}
                  fill
                  sizes="(min-width: 1024px) 420px, 90vw"
                  className="object-cover"
                />
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-[#D4A93A]"
                />
              </div>
            ) : (
              <div className="aspect-[4/5] w-full rounded-lg bg-neutral-100" />
            )}
          </div>

          <div>
            {c.name && (
              <h2 className="font-serif text-3xl font-semibold tracking-tight text-[#0F1B2D] sm:text-4xl">
                {c.name}
              </h2>
            )}
            {c.credentials_line && (
              <p className="mt-3 text-[12px] font-semibold tracking-[0.18em] uppercase text-[#1B3A5F]">
                {c.credentials_line}
              </p>
            )}
            {c.bio_html && (
              <div
                className="prose prose-neutral mt-6 max-w-none text-[#0F1B2D]"
                dangerouslySetInnerHTML={{ __html: c.bio_html }}
              />
            )}
            {(c.cta_primary_label || c.cta_secondary_label) && (
              <div className="mt-8 flex flex-wrap items-center gap-3">
                {c.cta_primary_label && c.cta_primary_href && (
                  <Link
                    href={c.cta_primary_href}
                    className="inline-flex items-center rounded-md bg-[#1B3A5F] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[#0F2540]"
                  >
                    {c.cta_primary_label}
                  </Link>
                )}
                {c.cta_secondary_label && c.cta_secondary_href && (
                  <Link
                    href={c.cta_secondary_href}
                    className="inline-flex items-center rounded-md border border-neutral-300 px-5 py-2.5 text-sm font-medium text-[#0F1B2D] transition hover:border-[#1B3A5F] hover:text-[#1B3A5F]"
                  >
                    {c.cta_secondary_label}
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
