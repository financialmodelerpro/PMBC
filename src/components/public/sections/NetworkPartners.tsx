import Link from 'next/link';
import Image from 'next/image';
import { ArrowUpRight } from 'lucide-react';

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

function pickPartners(c: Record<string, unknown>): { intro: string; heading: string; partners: Partner[] } {
  const intro = s(c.intro);
  const heading = s(c.heading);
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
  return { intro, heading, partners };
}

export function NetworkPartners({ content }: { content: Record<string, unknown> }) {
  const { intro, heading, partners } = pickPartners(content ?? {});
  if (partners.length === 0 && !heading && !intro) return null;

  return (
    <section className="px-6 py-20 lg:py-24">
      <div className="mx-auto max-w-6xl">
        {(heading || intro) && (
          <div className="mx-auto max-w-3xl text-center">
            {heading && (
              <h2 className="font-serif text-3xl font-semibold tracking-tight text-[#0F1B2D] sm:text-4xl">
                {heading}
              </h2>
            )}
            {intro && (
              <p className="mt-4 text-base text-neutral-600 sm:text-lg">{intro}</p>
            )}
          </div>
        )}

        {partners.length > 0 && (
          <div
            className={
              'mt-12 grid gap-6 ' +
              (partners.length >= 3 ? 'md:grid-cols-3' : partners.length === 2 ? 'md:grid-cols-2' : 'md:grid-cols-1')
            }
          >
            {partners.map((p, i) => {
              const inner = (
                <>
                  <div className="flex items-start justify-between gap-3">
                    {p.logo_url ? (
                      <div className="relative h-12 w-32 flex-shrink-0">
                        <Image
                          src={p.logo_url}
                          alt={p.name || 'Partner logo'}
                          fill
                          sizes="128px"
                          className="object-contain object-left"
                        />
                      </div>
                    ) : (
                      <div className="h-12 w-32 rounded bg-neutral-100" />
                    )}
                    {p.role_tag && (
                      <span className="inline-flex items-center rounded-full border border-[#D4A93A]/60 bg-[#D4A93A]/10 px-2.5 py-1 text-[10px] font-semibold tracking-[0.12em] uppercase text-[#8a6f1c]">
                        {p.role_tag}
                      </span>
                    )}
                  </div>
                  {p.name && (
                    <h3 className="mt-5 font-serif text-xl font-semibold tracking-tight text-[#0F1B2D]">
                      {p.name}
                    </h3>
                  )}
                  {p.location && (
                    <p className="mt-1 text-[12px] font-medium tracking-[0.08em] uppercase text-[#1B3A5F]">
                      {p.location}
                    </p>
                  )}
                  {p.description && (
                    <p className="mt-3 text-sm leading-relaxed text-neutral-600">
                      {p.description}
                    </p>
                  )}
                  {p.link && (
                    <span className="mt-5 inline-flex items-center gap-1 text-[12px] font-semibold tracking-wide text-[#1B3A5F]">
                      Visit site <ArrowUpRight size={12} />
                    </span>
                  )}
                </>
              );
              const className =
                'block h-full rounded-lg border border-neutral-200 bg-white p-6 transition' +
                (p.link ? ' hover:border-[#1B3A5F] hover:shadow-[0_2px_10px_rgba(15,27,45,0.06)]' : '');
              if (p.link) {
                const external = /^https?:/i.test(p.link);
                return (
                  <Link
                    key={i}
                    href={p.link}
                    className={className}
                    target={external ? '_blank' : undefined}
                    rel={external ? 'noreferrer' : undefined}
                  >
                    {inner}
                  </Link>
                );
              }
              return (
                <div key={i} className={className}>
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
