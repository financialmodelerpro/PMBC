import Link from 'next/link';

function s(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

type CtaContent = {
  headline: string;
  subhead: string;
  cta_primary_label: string;
  cta_primary_href: string;
  cta_secondary_label: string;
  cta_secondary_href: string;
  background_style: 'light' | 'dark' | 'accent';
};

function pick(c: Record<string, unknown>): CtaContent {
  const bg = c.background_style;
  const primaryObj = (c.primary_cta && typeof c.primary_cta === 'object'
    ? c.primary_cta
    : c.cta_primary && typeof c.cta_primary === 'object'
      ? c.cta_primary
      : {}) as Record<string, unknown>;
  const secondaryObj = (c.secondary_cta && typeof c.secondary_cta === 'object'
    ? c.secondary_cta
    : c.cta_secondary && typeof c.cta_secondary === 'object'
      ? c.cta_secondary
      : {}) as Record<string, unknown>;
  return {
    headline: s(c.headline),
    subhead: s(c.subhead),
    cta_primary_label: s(c.cta_primary_label) || s(c.cta_label) || s(primaryObj.label),
    cta_primary_href: s(c.cta_primary_href) || s(c.cta_href) || s(primaryObj.href),
    cta_secondary_label: s(c.cta_secondary_label) || s(secondaryObj.label),
    cta_secondary_href: s(c.cta_secondary_href) || s(secondaryObj.href),
    background_style: bg === 'dark' || bg === 'accent' ? bg : 'light',
  };
}

export function CtaBlock({ content }: { content: Record<string, unknown> }) {
  const c = pick(content ?? {});
  if (!c.headline && !c.subhead && !c.cta_primary_label) return null;

  const bg = c.background_style;
  const wrapperClass =
    bg === 'dark'
      ? 'bg-[#0F2540] text-white'
      : bg === 'accent'
        ? 'bg-[#1B3A5F] text-white'
        : 'bg-[#F7F9FC] text-[#0F1B2D]';

  const headlineClass =
    bg === 'light' ? 'text-[#0F1B2D]' : 'text-white';
  const subheadClass =
    bg === 'light' ? 'text-neutral-600' : 'text-[#E8EEF5]/80';

  const primaryClass =
    bg === 'light'
      ? 'bg-[#1B3A5F] text-white hover:bg-[#0F2540]'
      : 'bg-white text-[#0F2540] hover:bg-[#E8EEF5]';
  const secondaryClass =
    bg === 'light'
      ? 'border-neutral-300 text-[#0F1B2D] hover:border-[#1B3A5F] hover:text-[#1B3A5F]'
      : 'border-white/30 text-white hover:bg-white/5';

  return (
    <section className={`px-6 py-20 lg:py-24 ${wrapperClass}`}>
      <div className="mx-auto max-w-4xl text-center">
        {c.headline && (
          <h2 className={`font-serif text-3xl font-semibold tracking-tight sm:text-4xl ${headlineClass}`}>
            {c.headline}
          </h2>
        )}
        {c.subhead && (
          <p className={`mx-auto mt-4 max-w-2xl text-base sm:text-lg ${subheadClass}`}>
            {c.subhead}
          </p>
        )}
        {(c.cta_primary_label || c.cta_secondary_label) && (
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            {c.cta_primary_label && c.cta_primary_href && (
              <Link
                href={c.cta_primary_href}
                className={`inline-flex items-center rounded-md px-5 py-2.5 text-sm font-medium transition ${primaryClass}`}
              >
                {c.cta_primary_label}
              </Link>
            )}
            {c.cta_secondary_label && c.cta_secondary_href && (
              <Link
                href={c.cta_secondary_href}
                className={`inline-flex items-center rounded-md border px-5 py-2.5 text-sm font-medium transition ${secondaryClass}`}
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
