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
      className="relative flex min-h-[70vh] items-center px-6 py-24 sm:py-28"
      style={{
        background:
          'radial-gradient(ellipse at 50% 40%, #1F4269 0%, #1B3A5F 55%, #14304F 100%)',
        color: '#FFFFFF',
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(45deg, #C69C3E 0, #C69C3E 1px, transparent 1px, transparent 14px)',
        }}
      />
      <div className="relative mx-auto w-full max-w-[1100px] text-center">
        <div
          aria-hidden
          className="mx-auto h-px w-[80px]"
          style={{ background: '#C69C3E' }}
        />
        <p
          className="mt-6 text-[11px] font-semibold uppercase"
          style={{ letterSpacing: '0.18em', color: '#C69C3E' }}
        >
          {eyebrow}
        </p>
        {/* Kept in step with the CMS `hero` renderer: same heights, same
            wrapping rules, so a page gains nothing but content when an operator
            replaces this fallback with a real hero section. */}
        <h1
          className="pmbc-display mt-6 text-[40px] leading-[1.05] sm:text-[56px] lg:text-[64px] xl:text-[72px]"
          style={{ color: '#FFFFFF', textWrap: 'balance' }}
        >
          {headline}
        </h1>
        {tagline && (
          <p
            className="mx-auto mt-7 max-w-[820px] text-[18px] leading-[1.65] sm:text-[20px]"
            style={{ color: '#E8DDC4', textWrap: 'pretty' }}
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
          style={{ color: '#A88530' }}
          className="opacity-60"
        />
      </div>
    </section>
  );
}
