import Link from 'next/link';

type HeroContent = {
  badge_text?: string;
  badge?: string; // legacy seeded key
  headline?: string;
  subtitle?: string;
  cta_label?: string;
  cta_href?: string;
  cta_secondary_label?: string;
  cta_secondary_href?: string;
  background_style?: 'light' | 'dark';
};

function asString(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function pick(c: Record<string, unknown>): HeroContent {
  return {
    badge_text: asString(c.badge_text) || asString(c.badge),
    headline: asString(c.headline),
    subtitle: asString(c.subtitle),
    cta_label: asString(c.cta_label),
    cta_href: asString(c.cta_href),
    cta_secondary_label: asString(c.cta_secondary_label),
    cta_secondary_href: asString(c.cta_secondary_href),
    background_style: c.background_style === 'dark' ? 'dark' : 'light',
  };
}

export function Hero({ content }: { content: Record<string, unknown> }) {
  const c = pick(content ?? {});
  const dark = c.background_style === 'dark';

  return (
    <section
      className={
        'relative px-6 py-24 lg:py-32 ' +
        (dark ? 'bg-[#0F2540] text-white' : 'bg-white text-[#0F1B2D]')
      }
    >
      <div className="mx-auto max-w-5xl text-center">
        {c.badge_text && (
          <p
            className={
              'text-[11px] font-medium tracking-[0.22em] uppercase ' +
              (dark ? 'text-[#E8EEF5]/70' : 'text-[#1B3A5F]')
            }
          >
            {c.badge_text}
          </p>
        )}
        {c.headline && (
          <h1
            className={
              'mt-5 text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl ' +
              (dark ? 'text-white' : 'text-[#0F1B2D]')
            }
          >
            {c.headline}
          </h1>
        )}
        {c.subtitle && (
          <p
            className={
              'mx-auto mt-5 max-w-2xl text-base sm:text-lg ' +
              (dark ? 'text-[#E8EEF5]/80' : 'text-neutral-600')
            }
          >
            {c.subtitle}
          </p>
        )}
        {(c.cta_label || c.cta_secondary_label) && (
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            {c.cta_label && c.cta_href && (
              <Link
                href={c.cta_href}
                className={
                  'inline-flex items-center rounded-md px-5 py-2.5 text-sm font-medium transition ' +
                  (dark
                    ? 'bg-white text-[#0F2540] hover:bg-[#E8EEF5]'
                    : 'bg-[#1B3A5F] text-white hover:bg-[#0F2540]')
                }
              >
                {c.cta_label}
              </Link>
            )}
            {c.cta_secondary_label && c.cta_secondary_href && (
              <Link
                href={c.cta_secondary_href}
                className={
                  'inline-flex items-center rounded-md border px-5 py-2.5 text-sm font-medium transition ' +
                  (dark
                    ? 'border-white/30 text-white hover:bg-white/5'
                    : 'border-neutral-300 text-[#0F1B2D] hover:border-[#1B3A5F] hover:text-[#1B3A5F]')
                }
              >
                {c.cta_secondary_label}
              </Link>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
