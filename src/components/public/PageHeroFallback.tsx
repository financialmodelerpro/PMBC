import { ChevronDown } from 'lucide-react';

/**
 * Default hero shown on a bespoke firm page when the CMS page has no `hero`
 * section yet. Once an admin adds a hero block via the page builder, that
 * block takes over and this fallback is no longer rendered.
 *
 * Matches the navy-deep premium hero treatment used on the home page so the
 * firm pages share the editorial opening rhythm.
 */
export function PageHeroFallback({
  eyebrow,
  headline,
  tagline,
}: {
  eyebrow: string;
  headline: string;
  tagline?: string;
}) {
  return (
    <section
      className="relative flex min-h-[72vh] items-center px-6 py-28 sm:py-32"
      style={{
        background:
          'radial-gradient(ellipse at 50% 40%, #173E63 0%, #102E4C 55%, #0C2741 100%)',
        color: '#FFFFFF',
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(45deg, #D4A93A 0, #D4A93A 1px, transparent 1px, transparent 14px)',
        }}
      />
      <div className="relative mx-auto w-full max-w-[1100px] text-center">
        <div
          aria-hidden
          className="mx-auto h-px w-[80px]"
          style={{ background: '#D4A93A' }}
        />
        <p
          className="mt-6 text-[11px] font-semibold uppercase"
          style={{ letterSpacing: '0.18em', color: '#D4A93A' }}
        >
          {eyebrow}
        </p>
        <h1
          className="pmbc-display mt-6 text-[40px] leading-[1.05] sm:text-[56px] lg:text-[64px] xl:text-[72px]"
          style={{ color: '#FFFFFF' }}
        >
          {headline}
        </h1>
        {tagline && (
          <p
            className="mx-auto mt-7 max-w-[720px] text-[18px] leading-[1.65] sm:text-[20px]"
            style={{ color: '#E8DDC4' }}
          >
            {tagline}
          </p>
        )}
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-8 left-1/2 -translate-x-1/2"
      >
        <ChevronDown
          size={22}
          strokeWidth={1.5}
          style={{ color: '#B89530' }}
          className="opacity-60"
        />
      </div>
    </section>
  );
}
